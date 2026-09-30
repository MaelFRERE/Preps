# TriPlan 70.3 — PWA + notifications push sur Render

Cette version contient :
- une PWA installable sur téléphone ;
- un service worker ;
- des notifications push Web Push / Chrome Android ;
- un backend Node/Express ;
- une base PostgreSQL Render pour conserver les abonnements push ;
- un Cron Job Render toutes les 15 minutes ;
- une heure de rappel modifiable dans l'app ;
- aucun bouton de suppression des séances.

## 1. Générer les clés VAPID

Sur votre ordinateur, dans le dossier du projet :

```bash
npm install
npx web-push generate-vapid-keys
```

Copier la clé publique et la clé privée.

## 2. Déployer sur Render

1. Mettre ce dossier sur GitHub.
2. Dans Render : **New > Blueprint**.
3. Sélectionner le dépôt.
4. Render lira `render.yaml`.
5. Renseigner :
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
6. Modifier `VAPID_SUBJECT` si souhaité avec votre email.
7. Déployer.

Le blueprint crée :
- le Web Service ;
- le Cron Job ;
- la base PostgreSQL.

## 3. Installer sur Android / Chrome

1. Ouvrir l'URL Render dans Chrome.
2. Menu Chrome > **Ajouter à l'écran d'accueil** / **Installer l'application**.
3. Ouvrir l'app installée.
4. Onglet **Notifications**.
5. Cliquer **Activer les notifications**.
6. Autoriser les notifications Android/Chrome.
7. Choisir l'heure de rappel.

## 4. Test

Dans l'onglet Notifications, cliquer sur **Tester**.

## Limite importante

Une PWA ne peut pas empêcher Android ou Chrome de la désinstaller, ni empêcher l'utilisateur d'effacer les données du site.
L'interface ne propose toutefois aucun bouton permettant de supprimer les séances.

## Notes

- Le rappel est quotidien à l'heure choisie.
- Le push dit d'ouvrir l'app pour voir la séance du jour.
- Les séances sont stockées localement dans le navigateur.
- Les abonnements push sont stockés dans PostgreSQL.