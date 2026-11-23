# Direction visuelle — VerifyCheck Enterprise Light

## Décisions produit et surfaces

VerifyCheck est un outil de suivi des présences scolaires par QR code, destiné à un établissement en Guinée. Le produit comprend deux interfaces complémentaires :
- Dashboard Web : administration, consultation et supervision.
- Application Android native : sélection d'une séance, scan QR et historique des synchronisations.
- Cartes d'élèves imprimables : sorties physiques depuis le dashboard.

Une seule organisation est gérée par instance. L'interface est en français et utilise un thème clair sur les deux applications. Le dashboard ne propose pas de scan par webcam.

Contraintes structurantes : connectivité parfois faible, budget nul, données d'élèves potentiellement mineurs à minimiser, et besoin de consultation rapide de registres fiables.

## Directions examinées

### A. Enterprise Light — retenue

Une plateforme de gestion structurée : navigation latérale sur le Web, filtres persistants, tableaux de registre et surfaces claires. Côté mobile, l'identité reste légère et tactile, avec une séance clairement identifiée et un scanner immédiatement accessible.

Pourquoi : meilleure adéquation avec les tâches répétées de la direction, les consultations de registres et l'usage mobile sur des réseaux irréguliers. Cette direction reprend la discipline d'un registre scolaire sans conserver l'aspect papier ancien.

### B. Terminal de pointage

Une interface mobile de type borne opérationnelle, très contrastée, avec gros compteurs et retours de scan très visibles.

Pourquoi non retenue comme direction globale : elle fonctionne pour un terminal dédié, mais se transpose mal au dashboard administratif, aux tableaux et aux cartes imprimées. La caméra reste naturellement un flux vidéo ; les composants qui l'entourent demeurent clairs.

### C. Registre éditorial / papier

Une interface plus proche d'un cahier d'appel ou d'un journal, avec titres éditoriaux, longues listes et accents de papier.

Pourquoi non retenue comme direction principale : elle met trop l'accent sur la métaphore documentaire et pas assez sur la navigation multi-écrans, les filtres fréquents et les actions d'administration. Les tableaux restent néanmoins un élément central de la direction retenue.

## Direction retenue

**Enterprise Light — registre opérationnel scolaire.**

Le produit combine une hiérarchie Enterprise (navigation stable, surfaces structurées, filtres visibles) et une présentation de registre (tables lisibles, données tabulaires, statuts explicites). Le style doit rester calme, précis et léger : pas d'effets de démonstration.

### Différenciateurs

1. **Navigation de gestion persistante** : la direction retrouve chaque domaine depuis une sidebar stable, tandis que les tables restent le premier support de consultation.
2. **Présence contextualisée** : les états Présent, Non pointé et Absent restent distincts et liés à l'état réel de la séance.
3. **Confiance dans le scan** : l'application mobile distingue le résultat du scan, le compteur confirmé serveur et la file locale en attente.

## Palette et rôles

| Rôle | Valeur | Usage |
|---|---|---|
| Fond applicatif | #F3F6FA | arrière-plan du dashboard et de l'app mobile |
| Surface | #FFFFFF | navigation, formulaires, tableaux et panneaux |
| Encre | #172B45 | texte principal |
| Texte secondaire | #64748B | aides, métadonnées, libellés |
| Bleu principal | #17365D | navigation, actions principales et identité |
| Bleu secondaire | #315B86 | liens et accents secondaires |
| Succès | #16835D | présence confirmée et synchronisation confirmée |
| Attention | #A86F12 | non pointé, attente ou avertissement |
| Erreur | #BD4545 | absent, erreur et rejet |
| Bordure | #E2E8F0 | séparateurs et contours |
| Surface caméra de repli | #EAF0F5 | uniquement l'état caméra indisponible |

Le flux vidéo natif n'est pas un thème sombre : c'est le contenu de la caméra. Le reste de l'application mobile demeure clair.

## Typographie et densité

- Pile système sans téléchargement de police : Inter si déjà disponible, sinon system-ui, Segoe UI et Roboto.
- Nombres, identifiants et horodatages : chiffres tabulaires ou pile monospace lorsque cela améliore la lecture.
- Titres compacts, libellés explicites, métadonnées secondaires.
- Tables denses mais respirantes ; les données ne doivent pas être dispersées en cartes décoratives.

## Espacement et composants

- Base de 4 px : 4 / 8 / 12 / 16 / 24 / 32.
- Champs et boutons : hauteur cible 40–50 px selon la surface.
- Rayons : 8 px pour les contrôles, 12 px pour les panneaux.
- Bordures 1 px ; ombres discrètes réservées aux surfaces superposées.
- États textuels : toujours couleur + libellé, jamais couleur seule.
- Navigation Web latérale sur desktop, défilement horizontal lisible sur les largeurs réduites.
- Navigation mobile en bas, avec cibles tactiles et état actif explicite.

## Motion et accessibilité

Les transitions ne servent qu'à expliquer une interaction. Respect de prefers-reduced-motion. Focus visible, labels et messages d'erreur explicites, contraste lisible, navigation clavier Web et zones tactiles adaptées sur mobile.

## Contraintes d'implémentation

- Aucune dépendance payante ni nouvelle bibliothèque visuelle requise.
- Pas de faux chiffres, de données fictives de production ou d'états simulant une confirmation serveur.
- Préserver les API, l'authentification, les permissions, la caméra native et la file hors ligne.
- Le redesign ne doit pas inventer d'écrans d'administration dont le backend n'existe pas.
