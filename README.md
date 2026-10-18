# TriPlan v7.0 - Bilans souples et progression automatique a 10 %

Application web statique, sans serveur, sans compte, sans dependance externe et sans notification.
Le plan initial de 279 seances (12 octobre 2026 - 30 septembre 2027) est conserve.
L'interface reste claire, sur fond blanc, avec un accent violet discret.

## Mettre a jour le site Render existant

1. Decompresser le ZIP sur votre ordinateur.
2. Mettre son CONTENU dans votre depot GitHub, a la racine : index.html doit etre visible directement, pas dans un sous-dossier. Ne pas envoyer uniquement le fichier ZIP.
3. Conserver tous les fichiers JavaScript : app.js, model.js et plan.js sont necessaires.
4. Valider avec Commit changes. Laisser Render redeployer, ou choisir Manual Deploy > Deploy latest commit.
5. Garder le meme Static Site et la meme adresse pour retrouver les donnees de ce navigateur.

Reglages Render :
- Type : Static Site (ne pas creer de Web Service, Cron Job ou base de donnees).
- Root Directory : vide.
- Build Command : echo "No build"
- Publish Directory : .

Une fois deployee, la nouvelle interface affiche v7.0 en bas de page.
Ce ZIP ne modifie pas automatiquement votre depot ou votre service Render.

IMPORTANT : ne pas utiliser Clear site data / Effacer les donnees du site pour cette mise a jour.
Le site conserve l'historique local sous la meme cle que les v5 et v6 : triplan_full_year_v1.
Les anciens bilans, commentaires, ajustements et dates sont repris automatiquement sur la meme adresse et le meme navigateur.
Une copie brute de la v5 ou de la v6 est tentee avant migration, si le stockage local le permet. Aucune reinitialisation volontaire de l'historique n'est effectuee.
Les distances et durees reelles absentes des anciennes versions ne sont pas inventees : ouvrez leur bilan pour les completer.

## Deplacer ou modifier une seance

- Souris / tactile : saisir la poignee a six points en haut de la carte, puis relacher sur un autre jour.
- Sur telephone : le bandeau des sept jours reste visible pendant le defilement et sert aussi de zone de depot.
- Entre semaines : pendant un glissement, survoler la fleche precedente/suivante environ une seconde, puis deposer sur le jour souhaite.
- Alternative accessible : bouton Deplacer, ou activer la poignee au clavier, puis choisir une date. Pratique aussi pour changer de mois.
- Modifier permet de changer titre, duree prevue, contenu, date et distance prevue. Le sport d'une seance deja terminee reste fixe pour ne pas corrompre son bilan.
- Plusieurs seances peuvent etre placees le meme jour. Le glissement ne remplace pas les autres seances.
- Annuler dans le message de confirmation retablit le dernier deplacement si aucune autre modification n'a eu lieu depuis.

## Ajouter une seance

Utiliser Ajouter une seance ou le bouton + Ajouter d'un jour.
Renseigner sport, date, titre et duree prevue. Distance, contenu, lieu et rendez-vous sont facultatifs.
La natation utilise des metres ; velo et course utilisent des kilometres.
Les enchainements velo + course sont aussi disponibles.
Le programme initial n'est pas regenere : les seances ajoutees ne remplacent pas les 279 seances d'origine.

## Passage a la semaine suivante

- A l'ouverture : la semaine de la date locale du telephone ou de l'ordinateur est selectionnee.
- Si cette semaine a deja toutes ses seances traitees (terminees, ecourtees ou non faites, et reports hors de la semaine), l'app avance vers la suivante.
- Quand vous traitez la derniere seance restante d'une semaine, la semaine suivante s'ouvre automatiquement. Une seance non faite est traitee sans etre consideree comme reussie. Un report vers une autre semaine laisse une trace sur l'ancien jour et ne bloque pas la navigation ; un report au sein de la meme semaine reste a effectuer.
- Au changement de date, l'app se recale lorsqu'elle revient au premier plan (sans interrompre un formulaire ouvert).
- Les fleches et Plan complet permettent toujours de revoir le passe.
- Une semaine vraiment vide n'est pas consideree comme terminee. Une semaine videe par des reports explicites est, elle, consideree comme traitee.
- Hors des dates programmees, l'app reste sur la premiere ou derniere semaine disponible.

## Bilans et statistiques

Apres chaque seance :
- Ressenti : Facile / Normal / Difficile.
- Duree realisee en minutes : facultative pour Terminee, obligatoire pour Ecourtee. Valeurs decimales et virgules acceptees.
- Distance : kilometres pour course/velo, metres pour natation.
- Vitesse et allure calculees automatiquement des que duree et distance sont saisies.
- Commentaire facultatif.

La duree est celle que vous choisissez de reporter de votre montre. Pour comparer les vitesses, utilisez une convention coherente (par exemple duree en mouvement).
Il n'y a pas de mesure GPS ni d'import automatique depuis Strava.
Pour un enchainement, renseigner separement les parties velo et course.
Les bilans peuvent etre corriges sans declencher une deuxieme augmentation automatique.

Progression contient :
- Les trois sports ensemble ou filtres individuellement.
- Distance cumulee, duree reelle renseignee, nombre de seances, vitesse/allure moyenne par sport.
- Histogramme des durees hebdomadaires avec les trois disciplines et tableau des valeurs.
- Filtres de periode et derniers bilans.

Les moyennes de vitesse/allure sont calculees a partir des sommes de distance et duree des seuls bilans renseignant les deux valeurs. Ce n'est pas une moyenne simple des vitesses.
Les durees prevues ne sont PAS comptees comme des durees realisees. Les anciens bilans sans chiffres restent visibles mais n'inventent pas de volume.
Un enchainement compte pour une seance au total et pour une partie dans chacun de ses sports ; son temps n'est pas compte deux fois.

## Deload et couleurs

Le cycle initial 3 semaines + 1 deload et les samedis velo/enchainement une semaine sur deux sont conserves.
Une premiere validation Terminee + Facile applique automatiquement +10 % (arrondi a la minute) au volume PREVU de la prochaine seance non traitee du meme sport, au plus une fois par seance cible. Si une distance prevue existe, elle augmente aussi de 10 %. L'intensite ne change pas. Les minutes supplementaires sont indiquees comme faciles.
La base est le volume de la prochaine seance, pas le temps depasse sur la seance qui vient d'etre realisee : une cible de 60 min devient 66 min, meme si la seance terminee a dure 90 min.
Ecourtee, Non faite et Reportee : aucun +10 % ni rattrapage automatique.
Normal ou Difficile ne modifient pas la suivante.
Le taux de 10 % s'applique aux nouvelles validations eligibles. Les anciens ajustements de 5 % sont conserves et affiches comme anciens : aucun recalcul retroactif.
Corriger un bilan ne repete jamais l'augmentation. Si une correction retire la condition Terminee + Facile, une augmentation liee encore non realisee est retiree ; les seances deja realisees ne sont pas modifiees.
Aucun +10 % si la source ou la cible est une seance de deload, ou se trouve dans une semaine calendaire de deload.
La regle ne saute pas un deload pour reporter la hausse plus loin.
Si une seance automatiquement augmentee par cette app est deplacee vers un deload avant d'etre faite, cette hausse est retiree.
Un ajout manuel dans un deload ne reduit pas automatiquement son volume : une indication invite a conserver une semaine legere.

Les seances terminees sont attenuees : vert pour Facile/Normal, rouge pour Difficile.
Une journee traitee prend l'etat rouge si au moins une de ses seances realisees est difficile. Une seance non faite est grise, pas verte. Les seances ecourtees gardent la couleur de leur ressenti et un libelle explicite.

## Sauvegarder et changer d'appareil

Le bouton en haut a droite et le lien en bas de page exportent un fichier JSON.
Importer une sauvegarde permet de retrouver le planning sur un autre appareil. L'import demande confirmation car il remplace le planning de cet appareil.
Il n'y a pas de synchronisation automatique entre les appareils, navigateurs ou adresses du site.
Conserver une copie du fichier exporte en dehors du navigateur.

## Fichiers

- index.html : structure de l'interface.
- styles.css : interface claire et responsive.
- app.js : interface, deplacements, formulaires, graphiques, sauvegardes.
- model.js : dates locales, regles de progression, migration et calculs.
- plan.js : plan d'origine charge par l'application.
- plan.json : copie lisible du plan d'origine, pas l'historique local.
- favicon.svg : icone du site.
- tests/*.test.cjs : tests unitaires sans dependance.

Pour un essai local, ouvrir index.html ou servir le dossier avec python -m http.server 8000.
Pour une utilisation durable, utiliser l'adresse HTTPS de votre Static Site : le stockage des pages ouvertes en file:// peut varier selon le navigateur.

Tests de logique, avec Node.js installe :
    node --test tests/*.test.cjs

## Limite du plan d'entrainement

Cette mise a jour concerne l'application, pas une nouvelle prescription sportive. Le taux de 10 % est le reglage demande, pas une garantie de progression adaptee. Le plan annuel, les samedis alternes et les deloads sont conserves sans nouvelle prescription. Aucun questionnaire de recuperation ni validation manuelle de l'augmentation n'a ete ajoute.
La date exacte de course reste a preciser ; l'affutage de fin de plan devra etre recale sur cette date.
