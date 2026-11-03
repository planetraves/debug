"""Compile assets/strings/**/*.md into assets/strings.json during MkDocs builds."""

import json
from html.parser import HTMLParser
from pathlib import Path

from bs4 import BeautifulSoup
from markdown import Markdown
from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor
from mkdocs.exceptions import PluginError
from mkdocs.structure.files import File

_strings = {}


class _CaptureTree(Treeprocessor):
    def run(self, root):
        self.root = root


class _CaptureExtension(Extension):
    def extendMarkdown(self, md):
        self.capture = _CaptureTree(md)
        md.treeprocessors.register(self.capture, "string_sections", -100)


def collect_strings(directory, extensions=None, extension_configs=None):
    strings = {}
    headings = {f"h{level}": level for level in range(1, 7)}
    for path in sorted(Path(directory).rglob("*")):
        if not path.is_file() or path.suffix.lower() != ".md":
            continue
        capture = _CaptureExtension()
        enabled_extensions = list(extensions or ["extra", "toc"])
        if "toc" not in enabled_extensions:
            enabled_extensions.append("toc")
        renderer = Markdown(
            extensions=[*enabled_extensions, capture],
            extension_configs=extension_configs or {},
        )
        key = path.relative_to(directory).as_posix()
        strings[key] = renderer.convert(path.read_text(encoding="utf-8-sig"))
        elements = list(capture.capture.root)
        for index, element in enumerate(elements):
            if element.tag not in headings:
                continue
            section = []
            for following in elements[index + 1:]:
                if (
                    following.tag in headings
                    and headings[following.tag] <= headings[element.tag]
                ):
                    break
                section.append(renderer.serializer(following))
            content = "\n".join(section)
            for processor in renderer.postprocessors:
                content = processor.run(content)
            strings[f"{key}#{element.attrib['id']}"] = content.strip()
    return strings


def on_files(files, config, **kwargs):
    global _strings
    _strings = collect_strings(
        Path(config["docs_dir"]) / "assets" / "strings",
        config["markdown_extensions"],
        config["mdx_configs"],
    )
    for source in list(files):
        if (
            source.src_uri.startswith("assets/strings/")
            and source.src_uri.lower().endswith(".md")
        ):
            files.remove(source)
    files.append(File.generated(
        config,
        "assets/strings.json",
        content=json.dumps(_strings, ensure_ascii=False, indent=2) + "\n",
    ))
    return files


class _StringRenderer(HTMLParser):
    def __init__(self, output, page):
        super().__init__(convert_charrefs=False)
        self.output = output
        self.page = page
        self.line_offsets = [0]
        for line in output.splitlines(keepends=True):
            self.line_offsets.append(self.line_offsets[-1] + len(line))
        self.target = None
        self.depth = 0
        self.replacements = []

    def _source_offset(self):
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        key = dict(attrs).get("data-string")
        if key is not None:
            if self.target is not None:
                raise PluginError(f"Nested data-string in {self.page.file.src_uri}")
            if key not in _strings:
                raise PluginError(
                    f"Unknown Markdown string {key!r} in {self.page.file.src_uri}"
                )
            content = _strings[key]
            if tag == "span":
                fragment = BeautifulSoup(content, "html.parser")
                if len(fragment.contents) == 1 and fragment.contents[0].name == "p":
                    fragment.p.unwrap()
                    content = str(fragment)
            self.target = (tag, self._source_offset() + len(self.get_starttag_text()), content)
            self.depth = 1
        elif self.target is not None and tag == self.target[0]:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        if "data-string" in dict(attrs):
            raise PluginError(
                f"data-string needs a closing tag in {self.page.file.src_uri}"
            )

    def handle_endtag(self, tag):
        if self.target is None or tag != self.target[0]:
            return
        self.depth -= 1
        if self.depth == 0:
            _, start, content = self.target
            self.replacements.append((start, self._source_offset(), content))
            self.target = None


def on_post_page(output, page, config, **kwargs):
    renderer = _StringRenderer(output, page)
    renderer.feed(output)
    renderer.close()
    if renderer.target is not None:
        raise PluginError(f"Unclosed data-string element in {page.file.src_uri}")
    for start, end, content in reversed(renderer.replacements):
        output = output[:start] + content + output[end:]
    return output