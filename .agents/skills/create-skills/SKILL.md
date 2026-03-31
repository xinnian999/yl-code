---
name: create-skills
description: Helps create a new local skill skeleton when the user asks to add, scaffold, bootstrap, or draft a reusable skill for this agent. Use this skill when the goal is to create a new SKILL.md-based capability instead of solving a one-off task.
aliases:
  - make-skill
  - scaffold-skill
---

# Create Skills

This skill helps create a new local skill skeleton for the current workspace or user directory.

## When to Use This Skill

Use this skill when the user:

- asks to create a new skill
- wants to package repeated workflows as a reusable capability
- wants to draft a `SKILL.md` template
- asks to scaffold or bootstrap a skill directory

Do not use this skill when the user only wants help with a single one-off task and does not need a reusable skill.

## Default Target Location

Prefer creating new skills in the current workspace:

```text
.agents/skills/<skill-name>/SKILL.md
```

If the current workspace is not appropriate for storing the skill, fall back to:

```text
~/.yl/skills/<skill-name>/SKILL.md
```

## Naming Rules

- Use lowercase letters, digits, and hyphens only
- Keep the name short and action-oriented
- The directory name must match the skill name exactly

Examples:

- `create-skills`
- `review-pr`
- `release-checklist`
- `react-performance`

## Minimum Required Files

Create the smallest useful structure first:

```text
<skill-name>/
└── SKILL.md
```

Only add optional directories if the task truly needs them:

- `references/` for large supporting docs
- `scripts/` for repeatable deterministic scripts

Do not create extra files like `README.md`, `CHANGELOG.md`, or setup guides unless the user explicitly asks for them.

## Required SKILL.md Shape

Every new skill must contain:

1. YAML frontmatter with:
   - `name`
   - `description`
   - optional `aliases`
2. A Markdown body that explains:
   - when to use the skill
   - how to execute the workflow
   - important constraints and failure handling

## Authoring Guidelines

- Keep the description specific enough that the agent can decide when to load it
- Keep the body concise and procedural
- Prefer reusable workflow guidance over project-specific one-off instructions
- Put large details into `references/` only when necessary
- Make the skill usable without relying on UI-only behavior

## Suggested Creation Flow

1. Confirm the skill goal and choose a hyphen-case name.
2. Choose the target directory, preferring `.agents/skills/<skill-name>/`.
3. Create `SKILL.md` with frontmatter and a concise workflow body.
4. If the skill needs large reference material, add `references/`.
5. Keep the first version minimal and runnable.

## Starter Template

```md
---
name: my-skill
description: Briefly explain what the skill does, when it should be used, and what kind of requests should trigger it.
aliases:
  - optional-alias
---

# My Skill

## When to Use This Skill

- Describe the trigger cases

## Workflow

1. Step one
2. Step two
3. Step three

## Constraints

- Important limits
```
