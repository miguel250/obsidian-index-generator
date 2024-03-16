# Obsidian Index Generator

Generates an index file with a list of all the notes in a folder.

### Installation

-   Download latest release from [obsidian-index-generator/releases)](https://github.com/miguel250/obsidian-index-generator/releases)
-   Unzipped release into your vault's .obsidian/plugins/ directory

### Example

```bash
- Daily:
  - 2024-01-01.md
  - 2024-01-02.md
  - 2024-01-03.md
```

Generated `Daily.md` file

```markdown
# 2024

-   [[2024-01-01]]
-   [[2024-01-02]]
-   [[2024-01-04]]

tags: #type/index
```

Templates:

```markdown
# {{title}}

{{content}}

tags: #type/index
```
