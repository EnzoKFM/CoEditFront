import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true })
markdown.renderer.rules.link_open = (tokens, index, options, _environment, renderer) => {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
    return renderer.renderToken(tokens, index, options)
}

export function renderMarkdown(content: string): string {
    return markdown.render(content)
}
