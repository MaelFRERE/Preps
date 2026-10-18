# Verification v7.0

- 42 tests unitaires Node.js : reussis.
- 61 controles de l'interface Chromium : reussis.
- Inspection visuelle du bilan mobile apres correction de la largeur des champs.
- Planning initial : 279 seances. plan.js et plan.json identiques octet pour octet a la v6.
- Tests des largeurs 320, 360, 390, 430, 768, 1024 et 1440 px, y compris les champs reels des bilans.

## Controles d'interface executes

- mobile opens current week and preserves the annual plan
- four outcome controls visible
- no recovery questionnaire added
- duration over plan accepted with live difference
- full workout stores real duration without changing planned duration
- next same sport increased by 10 percent automatically
- normal or easy completed card green
- correcting a workout does not duplicate the increase
- shortened swim saves metres as kilometres and only realised duration
- hard shortened workout remains red
- shortened workout does not increase next swim
- non-performed outcome hides ratings and actual statistics
- missed session neutral and never counted as completed
- report moves same session without duplication
- report leaves an original-day trace
- partly unresolved week stays visible
- adding a personal workout still works and escapes HTML
- progression retains three sports
- stats use performed real duration, including shortened and excluding skipped
- chart includes the three measured sports
- individual sport filter works with shortened session
- export includes outcomes, reasons and reports
- import retains realised statistics and all 280 sessions
- no uncaught JavaScript errors in workflows
- last missed workout advances to next week
- v6 raw backup made before migration
- reopening after treated week starts on following week
- last reported workout advances to following week
- report never appears as a performed statistic
- desktop drag and drop persists new date
- undo of drag restores original date
- desktop has no uncaught errors
- shortened workout requires measured time with inline error
- report cannot destroy an already performed history
- no horizontal overflow at 320px
- feedback content fits at 320px
- actual inputs stay within their field at 320px
- no horizontal overflow at 360px
- feedback content fits at 360px
- actual inputs stay within their field at 360px
- no horizontal overflow at 390px
- feedback content fits at 390px
- actual inputs stay within their field at 390px
- no horizontal overflow at 430px
- feedback content fits at 430px
- actual inputs stay within their field at 430px
- no horizontal overflow at 768px
- feedback content fits at 768px
- actual inputs stay within their field at 768px
- no horizontal overflow at 1024px
- feedback content fits at 1024px
- actual inputs stay within their field at 1024px
- no horizontal overflow at 1440px
- feedback content fits at 1440px
- actual inputs stay within their field at 1440px
- touch drag still moves sessions on mobile
- touch interactions cause no uncaught JavaScript errors
- historical 5 percent increase is labelled as historical
- legacy feedback corrections do not apply new 10 percent again
- deload source blocks 10 percent in UI
- deload workflow has no JavaScript errors

## Perimetre des tests

Chromium headless, interaction a la souris et emulation tactile. Les fichiers HTML/CSS/JS ont ete injectes directement dans le navigateur car la navigation reseau/localhost est bloquee dans cet environnement. Un adaptateur Storage en memoire a servi aux tests de persistance, migration et export/import. Les calculs et la serialisation sont aussi verifies dans les tests Node.js.

Ces controles ne constituent pas un test sur telephone physique ni sur le site Render deploye. La sauvegarde reelle depend des autorisations de stockage du navigateur sur l'adresse utilisee. Aucun deploiement Render ni modification du depot GitHub n'a ete effectue ici.
