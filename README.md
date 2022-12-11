# bot-boilerplate

Boilerplate for TCD Discord bots.

## Note about dependencies

`typescript` is declared as a prod dependency, defying convention, because Heroku uninstalls all devDeps before the release phase. This is a problem because `slash-up` uses `ts-node` internally, which doesn't depend on `typescript`, so we need to have it in the prod deps.
