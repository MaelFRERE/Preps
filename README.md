# RunPrep MultiSport V2

PWA statique et gratuite de préparation sportive, sans API externe et sans compte.

## Sports inclus

- Course à pied : 5 km, 10 km, semi-marathon, marathon et distance personnalisée.
- Triathlon : Sprint, Standard, 70.3 et longue distance ; répartition natation / vélo / course et séances enchaînées.
- HYROX : course, force, travail des stations, engine, compromised running et simulations progressives.

Le format HYROX utilisé par la V2 suit la structure publique officielle : 8 x 1 km de course, chacun suivi d'une station (SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Row, Farmers Carry, Sandbag Lunges, Wall Balls). Les charges ne sont pas figées dans le moteur : l'utilisateur doit suivre les règles de sa division.

Pour le triathlon, les formats Sprint et Standard utilisent les distances courantes officielles (Sprint : 750 m / 20 km / 5 km ; Standard : 1,5 km / 40 km / 10 km). Les formats longue distance sont proposés comme profils pratiques de planification.

## Fonctionnalités

- Questionnaire adapté au sport sélectionné
- Questionnaire de sécurité sportive commun
- Génération du plan jusqu'au jour J
- 2 à 7 séances / semaine selon le sport
- Phases base, développement, spécifique, affûtage et course
- Retours après séance : faite/ratée, difficulté, fatigue, douleur, note
- Adaptation conservatrice de la charge sur les jours suivants
- Données enregistrées en local avec `localStorage`
- PWA installable et cache hors ligne
- Notifications navigateur lorsque l'app est active
- Export calendrier `.ics` avec rappel 30 minutes avant
- Aucune clé API, aucun backend et aucun abonnement requis

## Lancer en local

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Mettre sur GitHub

Depuis le dossier du projet :

```bash
git init
git add .
git commit -m "RunPrep MultiSport V2"
git branch -M main
git remote add origin https://github.com/TON-UTILISATEUR/runprep-multisport.git
git push -u origin main
```

Crée d'abord un dépôt vide `runprep-multisport` sur GitHub, sans README ajouté automatiquement, puis remplace `TON-UTILISATEUR` dans l'URL.

## Déployer sur Render

Le projet est 100 % statique. Dans Render :

1. `New` -> `Static Site`.
2. Connecter le dépôt GitHub `runprep-multisport`.
3. Branch : `main`.
4. Build Command : laisser vide.
5. Publish Directory : `.`.
6. Créer le site.

Render fournit ensuite une URL `*.onrender.com` et redéploie automatiquement après les nouveaux pushes GitHub.

Le fichier `render.yaml` est inclus pour documenter la configuration statique du projet.

## Limite des notifications

Sans backend de Web Push, une PWA fermée n'est pas garantie d'exécuter un minuteur local sur mobile. L'export `.ics` est donc la méthode gratuite recommandée pour obtenir des rappels fiables via le calendrier du téléphone.

## Sécurité

RunPrep n'est pas un dispositif médical et n'établit aucun diagnostic. Un signal d'alerte dans le questionnaire bloque la génération automatique. Une douleur inhabituelle déclarée après une séance neutralise temporairement les séances exigeantes, sans chercher à déterminer la cause.
