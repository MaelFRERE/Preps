# RunPrep V3 : methode, limites et references

## Statut du logiciel

Prototype experimental. Ce moteur n'a pas ete valide par un essai clinique, un entraineur ou une federation. Les tests automatiques verifient des proprietes du logiciel, PAS l'efficacite sportive, l'absence de blessure ou l'aptitude a participer a une epreuve. Un programme detaille n'est pas une garantie de preparation suffisante.

Le moteur concerne les adultes sans signal d'alerte declare. Il ne personnalise pas la reprise apres blessure, la grossesse, les pathologies, les traitements, les situations de handicap, les mineurs ni le sport de haut niveau. Un accompagnement qualifie est necessaire dans les situations particulieres. Une maladie ou douleur declaree suspend les prochaines prescriptions, competition comprise. Le logiciel ne fixe aucune date de guerison.

## Ce qui est calcule

1. Validation des dates, unites, volumes actuels et disponibilites. `25:30` signifie 25 minutes 30 secondes. Les heures necessitent trois composantes : `01:25:30`.
2. Fenetre de preparation par sport et format. Au-dela, une phase d'entretien/fondations evite une augmentation continue pendant un an. Les seances a plus de 14 jours sont marquees provisoires ; reevaluer regulierement le profil avec la pratique effectivement realisee.
3. Budgets distincts : minutes de course, minutes de velo, metres de nage, minutes de renforcement. Le chrono cible n'est jamais confondu avec le niveau actuel. Sans reference, les efforts sont prescrits au ressenti.
4. Repartition sur les jours disponibles. Un creneau long a sa propre limite, les jours de piscine sont respectes. A cinq creneaux triathlon, alternance une/deux nages selon les semaines pour garder une sortie longue course et des contacts velo. C'est un compromis, pas une repartition ideale universelle.
5. Construction des blocs : echauffement, travail, recuperations, retour au calme. Les temps sont additionnes en secondes entieres. La nage est construite par multiples de 25 m ; sa duree est une estimation a partir de l'allure declaree et des repos explicites. Sans allure nage : 2:30/100 m uniquement pour estimer le temps, jamais comme vitesse a atteindre.
6. Verification apres plafonnement : temps total, volumes par discipline, coherence des blocs, jours disponibles et proximite de la competition. Une reduction recalcule les blocs et leurs descriptions.
7. Bilans : duree effectivement realisee, difficulte, fatigue, douleur, maladie. Les notes libres ne sont pas analysees. Un bilan absent n'est pas automatiquement une seance ratee. Les adaptations sont reconstruites depuis le plan de reference : enregistrer deux fois le meme bilan ne cumule pas deux reductions.

## Choix de conception : non valides comme seuils de securite

Les valeurs suivantes sont des garde-fous logiciels configurables, pas des lois physiologiques :

- Cycle de deux semaines de travail / une allegee pour les moins experimentes ; trois / une dans les autres cas. Depart autour de 92 % du volume saisi. Le cycle ne signifie pas que ces proportions conviennent a chacun.
- Progressions indicatives : 3 % pour la course, 4 a 4,5 % pour la nage/velo, 2 % pour la force ; plafond de croissance depuis la base. Une deuxieme verification limite l'augmentation du travail reel emis, en prenant les trois dernieres semaines ordinaires disponibles comme reference.
- Les plus longues sorties recentes plafonnent aussi les seances ordinaires. Une faible base course utilise de la course/marche ; aucune seance de sprint maximal. Pas de remplissage automatique des minutes inutilisees.
- Semaines allegees plafonnees par rapport au travail effectivement programme, et non seulement par rapport a un objectif de volume qui pourrait etre ecrete par les disponibilites.
- Affutage sur 7 a 21 jours selon l'epreuve : volume reduit, pas de blocs intenses dans les trois derniers jours, veille libre. La V3 est deliberement conservative ; elle ne reproduit pas a l'identique les protocoles d'affutage des sportifs entraines.
- Reperes de creneau velo long : 90 min Sprint, 120 min Standard, 180 min 70.3, 240 min longue distance. Ce sont des REPERES DE DIAGNOSTIC LOGICIEL, pas des minimums universels ni une preuve de preparation quand ils sont atteints.
- Fatigue haute : reductions provisoires de 15 % ou 30 %, sans rattrapage. Deux seances ratees recentes ou une duree tres inferieure a celle prevue peuvent aussi reduire le plan. La derniere fatigue elevee ne disparait pas simplement parce que sept jours ont passe sans nouveau bilan.
- Indice de charge = somme (minutes du bloc x effort estime). Il n'est pas comparable entre athletes ou sports comme une mesure physiologique. Aucune probabilite de blessure, aucun diagnostic et aucune promesse de chrono ne sont calcules.

Une contrainte peut rendre l'objectif inapproprie ou la preparation insuffisante. L'application respecte les contraintes, avertit, et ne rallonge pas artificiellement les seances. La longue distance et les divisions HYROX Pro/Doubles/Relay restent des ebauches generales necessitant une relecture et des decisions de terrain.

## References consultees le 28 septembre 2026

Ces references motivent des PRINCIPES GENERAUX. Elles ne valident ni ce code ni ses coefficients.

### Individualisation et suivi

Australian Institute of Sport, "Training load in relation to loading and unloading phases of training". Le suivi doit tenir compte de la reponse individuelle, de l'historique et de la recuperation ; le volume seul ne suffit pas a decider.
https://www.ausport.gov.au/ais/position_statements/training-load-in-relation-to-loading-and-unloading-phases-of-training

### Affutage

Wang et al. (2023), *Effects of tapering on performance in endurance athletes: A systematic review and meta-analysis*, PLOS ONE, DOI 10.1371/journal.pone.0282838. La synthese etudie notamment la reduction du volume avant competition chez des athletes d'endurance ; on ne peut pas extrapoler ses effets a tous les debutants ou a ce logiciel.
https://pubmed.ncbi.nlm.nih.gov/37163550/

### Format HYROX

HYROX, "The Fitness Race" : alternance de huit courses de 1 km et huit stations. Les charges, repetitions applicables et regles doivent etre verifiees pour la division et la saison. La V3 n'impose aucune charge de competition et nomme ses variantes comme non equivalentes.
https://hyrox.com/the-fitness-race/

### Signaux d'alerte

Assurance Maladie, "Reconnaitre une douleur thoracique qui necessite des soins urgents" (17 mars 2026). Des symptomes aigus graves necessitent les secours ; ne pas utiliser le questionnaire pour retarder la prise en charge. En France : 15 / 112.
https://www.ameli.fr/assure/sante/themes/douleur-thoracique/reconnaitre-agit-urgence

## Notifications et calendrier

Les minuteurs de page et service workers ne sont pas des alarmes garanties quand le navigateur est ferme. Cette version n'a ni backend ni Web Push. Les notifications sont tentees dans les 30 minutes avant une seance pendant l'utilisation de l'app. L'autorisation peut etre refusee ou indisponible selon l'appareil.

Reference : MDN, *Offline and background operation*.
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation

L'ICS contient les vrais blocs, un DTSTAMP, des UID, un SEQUENCE et un pliage UTF-8. Les horaires sont convertis en UTC a partir du fuseau du navigateur lors de l'export, changement d'heure compris. La competition est un evenement journee entiere car son horaire n'est pas connu. Les rappels dependent de l'agenda et de ses reglages. Il s'agit d'un export, pas d'un abonnement synchronise : supprimer l'ancien calendrier dedie avant de reimporter une nouvelle version pour eviter des doublons ou d'anciennes prescriptions.
