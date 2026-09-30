# TriPlan 70.3

Application web locale de suivi de preparation triathlon 70.3.

## Lancer l application

Option simple : ouvrir `index.html` dans un navigateur moderne.

Option recommandee : lancer un petit serveur local depuis ce dossier :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Fonctionnalites

- Vue semaine par semaine
- Planning a partir du 12 octobre 2026
- Retour Facile / Normal / Difficile
- +5 % automatique sur la prochaine seance du meme sport si la seance est notee Facile
- Ajout manuel de seances
- Historique et volume hebdomadaire
- Suivi vers l objectif 70.3 septembre 2027
- Donnees conservees dans le navigateur via localStorage

## Fichiers

- `index.html` : structure de l application
- `styles.css` : design responsive
- `app.js` : logique, planning, progression et stockage
- `data/` : reserve pour futurs exports/donnees
