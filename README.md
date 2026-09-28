# RunPrep MultiSport V3

Mise a jour complete de la V2 : meme principe de site statique, moteur de planification remplace et isole dans `engine.js`. Aucune API payante, aucun abonnement logiciel, aucune cle, aucun compte requis. Hebergement externe soumis a ses propres conditions et quotas.

**Prototype experimental, non valide cliniquement. Les tests logiciels ne prouvent ni l'efficacite de l'entrainement ni son innocuite. Lire METHODE.md.**

## Mettre a jour TON site GitHub / Render existant

Il n'est pas necessaire de creer un nouveau depot ou un nouveau service.

1. Decompresser le ZIP. Ouvrir le dossier `runprep-multisport-v3`.
2. Dans le depot existant `MaelFRERE/Preps`, choisir `Add file` > `Upload files`.
3. Glisser **tout le contenu** du dossier, avec `engine.js`, `calendar.js`, les fichiers existants et le dossier `icons`. Ne pas envoyer le ZIP ni ajouter un niveau de dossier. `index.html` reste a la racine.
4. Valider le commit sur `main` (ou fusionner la branche de mise a jour).
5. Render redeploie si Auto-Deploy est active sur `main`. Sinon : `Manual Deploy` > `Deploy latest commit`.
6. Conserver : Static Site, Root Directory vide, Build Command `echo "No build"`, Publish Directory `.`.
7. Ouvrir le site. Verifier que l'accueil indique **V3**. Si V2 reste visible, fermer tous les onglets et la PWA, rouvrir avec une connexion puis recharger. Sur PC, `Ctrl + Shift + R`. Ne pas effacer le stockage avant d'avoir conserve les donnees utiles.
8. L'ancien profil V2 est detecte mais son programme errone n'est jamais reconduit. Cliquer sur `Revoir mon profil`, saisir les volumes REELS en minutes, verifier les chronos et regenerer. La V2 reste dans sa cle locale jusqu'a un effacement explicite.

**Ne pas publier tes sauvegardes personnelles JSON ou ton calendrier ICS dans le depot public.** Le `.gitignore` protege Git en ligne de commande, mais ne filtre pas un upload manuel sur le site GitHub.

References de deploiement :
https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
https://render.com/docs/static-sites
https://render.com/docs/deploys

## Lancer en local

Dans le dossier, avec Python installe :

```sh
python -m http.server 8080
```

Ou `python3 -m http.server 8080` selon l'installation. Ouvrir `http://localhost:8080`. L'ouverture directe du fichier HTML n'offre pas le mode PWA/service worker. Sur telephone, utiliser le site HTTPS deploye.

## Ce qui change

- Lecture des chronos corrigee : `25:30` = 25 minutes 30 ; `01:25:30` = 1 h 25 min 30.
- Les objectifs chronometriques ne deviennent jamais une estimation du niveau actuel.
- Minutes et metres de pratique recente, derniere sortie longue, budgets distincts par discipline, jours de piscine, creneau long et plafond hebdomadaire.
- Phases avec entretien/fondations pour les objectifs lointains, semaines allegees et affutage base sur la date exacte.
- Chaque seance contient des blocs calcules dont la somme correspond a sa duree. Nage en metres ; ses temps restent estimes.
- Verifications apres plafonnement : une semaine allegee ne conserve pas toutes ses seances au meme plafond par accident.
- Bricks qui ne suppriment pas la sortie longue course. Compromis de frequence explicitement signales si les creneaux sont limites.
- Retour seance avec duree realisee. Adaptations non cumulatives a enregistrement identique ; aucune seance manquee a rattraper.
- Douleur/maladie : suspension, y compris jour J. Pas de reprise automatique supposee.
- Details consultables pour toutes les seances, vue du volume des semaines, avertissements et projections visibles.
- Sauvegarde/import JSON V3 prive ; migration V2 prudente ; erreurs de stockage signalees.
- Calendrier avec DTSTAMP, pliage UTF-8, evenement de course sans horaire invente. Pas de synchronisation automatique de l'ICS.

## Tests reproductibles

Node.js est necessaire seulement pour les tests, PAS pour utiliser le site. Aucune installation npm.

```sh
node --test tests/engine.test.cjs
```

La suite contient des cas de regression et une matrice de 72 profils combinant sports, frequences, horizons et durees. Les verifications portent sur le calcul, les contraintes et l'export, pas sur la validite d'une prescription sportive. `TESTS.md` precise les controles effectivement realises dans l'environnement de fabrication.

## Fichiers

- `engine.js` : moteur pur, accessible en navigateur et via Node.
- `app.js` : interface, persistance locale, bilans et notifications.
- `calendar.js` : export iCalendar sans dependance.
- `index.html`, `styles.css` : interface responsive.
- `sw.js`, `manifest.webmanifest`, `icons/` : PWA.
- `METHODE.md` : hypotheses, limites et references.
- `tests/engine.test.cjs` : tests du moteur et de l'export.
- `render.yaml` : configuration indicative pour une nouvelle installation ; ne change pas automatiquement un service existant.

## Limites a ne pas masquer

Pas d'IA generative, de diagnostic, d'analyse des notes libres, de connexion Garmin, de capteurs ni de prediction de performance. Une preparation 70.3 en cinq creneaux courts peut rester insuffisante : la V3 le signale, elle ne transforme pas magiquement une disponibilite limitee en preparation complete.

Pas de notifications garanties app fermee : pas de serveur Web Push. Le calendrier peut fournir les rappels hors app selon ses reglages. Pas de synchronisation entre appareils. Le plan est une projection a reevaluer avec les volumes effectivement toleres et, notamment pour la longue distance, un professionnel qualifie.
