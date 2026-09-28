# Verification de RunPrep V3

Controles executes le 28 septembre 2026 dans l'environnement de fabrication.

## Moteur et export : 38 tests passes, 0 echec

Commande : `node --test tests/engine.test.cjs` (Node 22.16.0).

La suite inclut une matrice de **72 configurations fictives** : 3 sports x 4 frequences x 3 horizons x 2 limites de duree. Ces 72 configurations appartiennent a un des 38 tests ; il ne s'agit pas de 72 essais sur des sportifs.

Sont notamment verifies : chronos mm:ss, dates et changement d'heure, inputs invalides, signaux d'alerte, acces natation/velo, contraintes de jours, metres de nage et sommes de blocs, plafond hebdomadaire, plus longue sortie recente, affutage, semaines allegees apres plafonnement, conservation de la sortie longue course, apparition de bricks et de sorties velo au-dela de 80 min lorsque les contraintes le permettent, signalement d'un 70.3 limite a 80 min, idempotence des adaptations, suspension douleur/maladie, absence de rattrapage, reprise graduelle apres fatigue, DTSTAMP et pliage iCalendar UTF-8.

## Interface : 19 controles passes

Chromium sans interface graphique, affichages de 1440 x 1000 et 390 x 844 pixels. Verifications : generation des trois sports, detail des blocs, bilan de fatigue, creation des contenus ICS/JSON, relecture de donnees conservees, absence de debordement horizontal sur les ecrans verifies, blocage securite, migration V2 et absence d'exception JavaScript durant ces parcours.

**Limitation importante de l'environnement :** la navigation HTTP du navigateur etait bloquee. Ces controles ont donc charge les fichiers HTML/CSS/JS directement en memoire, avec un substitut de localStorage. Ils ne prouvent pas le bon fonctionnement de la persistance native sur tous les appareils. Le script le mentionne explicitement. Les captures ne constituent pas un test sur un vrai telephone.

Script facultatif : `python tests/browser_smoke.py`, avec Playwright et Chromium deja installes. Utiliser `RUNPREP_CHROMIUM` pour preciser le chemin d'un executable si necessaire. Les sorties sont ecrites dans `tests-output/` (exclu de Git et du ZIP distribue).

## Distribution statique

Un serveur Python local a repondu HTTP 200 pour les 11 ressources verifiees (HTML, CSS, JavaScript, manifeste, service worker, icones PNG et methode). JSON du manifeste et existence des chemins d'icones verifies. Syntaxe des scripts JavaScript controlee.

## Non verifies dans cette livraison

- Installation PWA sur un vrai iPhone ou Android.
- Cycle complet de mise a jour V2 -> V3 du service worker sur le site Render reel.
- Cache hors ligne dans un navigateur naviguant sur le site reel.
- Reception effective de notifications systeme.
- Import dans chaque agenda tiers et execution de ses rappels.
- Efficacite des plans, prevention des blessures ou validation par un professionnel sportif/medical.

Ces limites n'empechent pas de tester le prototype ; elles empechent de presenter les tests logiciels comme une preuve de securite ou de performance sportive.
