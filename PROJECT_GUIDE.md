# CartOMC - Capacity Planning (Guide & Spécifications Projet)

> ⚠️ **INVARIANT & CONSIGNE ABSOLUE** : Ce document (`PROJECT_GUIDE.md`) sert de **référence absolue** pour l'architecture et les règles métier du projet. **Il doit impérativement être mis à jour à chaque fois qu'une demande ou évolution modifie le périmètre, les fonctionnalités ou les règles de fonctionnement de l'application.**

---

## 1. Stack Technique & Exécution

- **Frontend** : React + TypeScript (Vite), Recharts pour la restitution graphique, Lucide-react pour les icônes.
- **Style & Thème** : Dark mode moderne *"Modern Next-Gen / Dark Slate & Electric Cyan"* en Vanilla CSS (variables CSS globales dans `index.css`).
  - **Polices Google Fonts** : `Plus Jakarta Sans` (corps & grilles), `Outfit` (titres & en-têtes), `JetBrains Mono` (chiffres & badges).
  - **Design System** : Glassmorphism translucide (`backdrop-filter`), palette Dark Slate (`#0b1120`), accents Cyan Électrique (`#06b6d4`), contours avec lueurs néons et modaux anti-débordement responsive.
- **Base de données** : MongoDB local (`mongodb://localhost:27017/capacity_planning_cartomc`), via Mongoose.
- **Lancement** : Monorepo exécutable par la commande unique à la racine `npm run dev` (via `concurrently`).
- **Langue & Régionalisation** : Interface 100% en français (dates `JJ/MM/AAAA`, nombres avec virgule décimale).
- **Rôles & Accès (Client-side)** :
  - Administrateur / Manager (Accès complet, configuration, import d'absences)
  - Lead BA (Accès limité à l'estimation et ses projets, sélection de sa ressource BA)
  - Lecteur (Consultation seule)

---

## 2. Règles Métier & Invariants (À RESPECTER STRICTEMENT)

### A. Référentiel Ressources & Capacitif
1. **Ressource** : `matricule` (unique), `nom`, `type` ("Interne" | "Externe"), `role`, `estLeadBA` (boolean), `tauxActivite` (ETP de 0 à 1, ex: 1 ou 0.5), `dateArrivee`, `dateDepart` (optionnelle), `actif` (boolean).
2. **Capacitif Théorique** :
   - TOUTES les ressources paramétrées et actives comptent dans la capacité théorique (aucun filtre par rôle).
   - `ETP du mois` = somme des `tauxActivite` des ressources actives sur le mois (actives = `dateArrivee <= fin du mois` ET (`dateDepart` vide OU `>= debut du mois`) ET `actif == true`).
3. **Modal de Création / Édition de Ressource (Design Glassmorphism & Profil Visuel)** :
   - En-tête dynamique avec avatar calculé en temps réel (initiales), badges de population (`Interne` cyan / `Externe` violet) et indicateur Lead BA doré.
   - **Cartes interactives structurées** :
     - *Identité & Profil* : matricule, nom complet, population et rôle métier.
     - *Capacité & Engagement* : saisie d'ETP numérique et raccourcis rapides en 1 clic (100%, 80%, 50%), carte à cocher moderne Lead BA.
     - *Contrat & Statut* : dates d'arrivée/départ et carte toggle visuelle moderne *Actif (Vert)* / *Inactif (Rouge)*.
   - **Footer d'action fixé** : Boutons "Annuler" et "Enregistrer les modifications" / "Créer le collaborateur" avec notification toaster (`showSuccess`).
4. **Bandeau de Cartes KPI Synthétiques d'Équipe (Style Visual Wow)** :
   - 4 cartes avec lueurs néon translucides :
     - *Effectif Actif* : Nombre total d'actifs sur effectif global, avec répartition en pastilles (Internes cyan 🔵 / Externes violet 🟣).
     - *Capacité Théorique* : Cumul global des ETP et moyenne d'ETP par collaborateur.
     - *Référents Lead BA* : Nombre de collaborateurs Lead BA habilités au chiffrage et au staffing.
     - *Cumul Congés / Absences* : Volume de jours d'absence sur l'année ou le mois filtré.
5. **Double Mode d'Affichage Référentiel (Trombinoscope Cartes Profils 🔁 Grille Dense)** :
   - Bouton de bascule dans la barre d'outils :
     - **Mode Cartes (Trombinoscope)** : Cartes individuelles glassmorphism avec avatar calculé (initiales), badges de population, rôle métier, jauge ETP cyan, dates de contrat et actions rapides.
     - **Mode Grille Dense** : Tableau compact avec avatars ronds miniatures, filtres par type, rôle métier et statut (Actif/Inactif).

### B. Calendrier, Jours Ouvrés & Jours Fériés Légaux (France Zone B)
1. **Déduction automatique des jours fériés légaux français (Zone B)** :
   - Le calcul automatique des jours ouvrés de chaque mois exclut systématiquement les **week-ends (Samedi / Dimanche)** ET les **11 jours fériés légaux français** (fixes : 1er Janvier, 1er Mai, 8 Mai, 14 Juillet, 15 Août, 1er Novembre, 11 Novembre, 25 Décembre + mobiles calculés automatiquement selon Pâques : Lundi de Pâques, Ascension, Lundi de Pentecôte).
2. **Plannings individuels des ressources** :
   - Les jours fériés sont identifiés et distingués visuellement (badge `🎉 Férié`, fond violet) sur la grille 7x6 du modal calendrier individuel.
3. **Forçage manuel** :
   - L'administrateur conserve la possibilité de surcharger manuellement le nombre de jours ouvrés d'un mois (ex: pour déduire des ponts d'entreprise spécifiques). Si renseigné, la valeur forcée prévaut sur le calcul automatique.

### C. Référentiel des Absences & Moteur de Capacité (Étape 2)
1. **Format CSV & Importation** :
   - Importation via l'écran **"Synchroniser les absences"** (réservé aux Administrateurs/Managers).
   - Auto-détection de la ligne d'en-tête des dates (`JJ/MM/AAAA`), de la colonne des matricules et de la première ligne de données, avec aperçu et possibilité pour l'utilisateur de corriger manuellement le mapping avant validation.
2. **Conventions de conversion des absences** :
   - **Convention Google Sheets (Par défaut)** : `0 = Absent (Vacances / 1.0j déperdition)`, `0.5 = Demi-journée (0.5j déperdition)`, `1 = Présent (0j déperdition)`.
   - **Convention Inversée** : `1 = Absent`, `0.5 = Demi-journée`, `0 ou vide = Présent`.
   - L'utilisateur peut permuter la convention avant import. Toute valeur non numérique ou vide sur un jour calendaire est traitée comme présent (0).
3. **Filtre & Upsert à l'import** :
   - Seuls les matricules existants dans le référentiel **Ressources** sont importés ; les autres lignes sont ignorées et listées dans le rapport d'importation.
   - Les données d'absences sont enregistrées en collection `AbsenceJournaliere` avec **upsert par matricule + date** (remplacement des valeurs existantes sur la plage de dates du fichier).
   - Affichage permanent de la date et de l'heure du dernier import validé dans l'en-tête de la page.
4. **Moteur de Calcul de Capacité Backend (`/api/capacite`)** :
   - Moteur backend réutilisable calculant mois par mois pour toute population (*Interne*, *Externe*, *Global*) :
     - `ETP du mois`
     - `Jours ouvrés` (Auto ou Forcé)
     - `Capacité Théorique = ETP * Jours ouvrés`
     - `Déperdition = Somme des absences (AbsenceJournaliere)` des ressources actives de la population sur le mois
     - `Capacité Nette = Capacité Théorique - Déperdition`
5. **Restitution, Heatmap & Consultation des Absences** :
   - **Moteur de Heatmap d'Absentéisme (`getAbsenceHeatmapStyle`)** : Calcul dynamique d'un code couleur thermique (du vert clair $<5\%$ au jaune $5-15\%$, orange $15-30\%$, rouge $30-50\%$ et rouge vif $>50\%$ 🔥) appliqué au taux de déperdition pour repérer immédiatement les périodes massives d'absentéisme (ponts de mai, mois d'août, fêtes de fin d'année).
   - **Tableau de vérification des capacités** : Intégré dans l'écran *Synchroniser les absences*, restituant le taux d'absentéisme par mois en mode Heatmap.
   - **Vue "Suivi des absences par ressource" (Redesign Visual Planning)** :
     - **Double mode de restitution** :
       - **Mode Cartes Synthèse Thermique** : Cartes individuelles glassmorphism avec avatar, badge de taux d'absentéisme coloré, **jauge d'impact capacitif (%)**, liste découpée des plages d'absence et accès direct au calendrier individuel.
       - **Mode Tableau Détaillé** : Vue tabulaire dense avec avatars miniatures, matricules mono, badges heatmap et bouton d'action vers le modal 7x6.
     - **Bandeau de synthèse rapide** : Nombre de personnes affichées et volume cumulé de jours d'absence calculé en direct.
   - **Vue Calendrier / Planning (Grid 7x5 jours)** : Modal individuel affichant les cartes de synthèse d'absentéisme et les badges d'absence.
6. **Détection des Absences Simultanées & Pics d'Absentéisme (`/api/absences/pics-simultanes`)** :
   - Moteur d'analyse identifiant automatiquement les dates où plusieurs ressources ($\ge 2, 3, 4, 5$ ressources) sont absentes le même jour.
   - **Widget interactif (`PicsAbsencesWidget`)** : Affiché en haut de la consultation des absences, restituant la liste chronologique des dates critiques, la déperdition cumulée du jour et le détail des personnes absentes (nom, rôle, type, valeur d'absence).
   - **Badges d'alerte dans les calendriers** : Signalement visuel `⚠️ N abs.` sur les cases des jours faisant partie d'un pic d'absence collectif.
7. **Contrôle de Saisie des Absences Jira vs Intentions CSV (`/api/absences/controle`)** :
   - **Principe** : Les collaborateurs indiquent leurs intentions de congés via le fichier CSV et doivent saisir leurs heures de congés réelles sur Jira sur le ticket dédié dont la clé change chaque année (ex : `HP-26` en 2026, configurable globalement via `jiraAbsenceIssueKey` dans `ConfigurationTolerances`).
   - **Conversion & Rapprochement** : $1\text{ jour d'absence} = 8\text{ heures}$ saisies dans Jira. Rapprochement automatique par **Prénom + Nom** de la ressource (matching de tokens insensible aux accents et à la casse).
   - **Filtrage Strict Équipe** : L'analyse restreint le périmètre aux seules ressources actives du référentiel `Ressources` de l'équipe. Toutes les imputations d'utilisateurs externes à l'équipe sur le ticket Jira sont ignorées en aval pour ne garder qu'une restitution 100% propre.
   - **Statuts de Conformité** : `CONFORME` 🟢 (Jira = CSV à $\pm 0,05\text{j}$), `SOUS_SAISIE` / `NON_SAISI` 🔴 (heures Jira $<$ congés CSV ou 0h), `SUR_SAISIE` 🟠 (heures Jira $>$ congés CSV).
   - **Interface de contrôle (`ControleAbsencesJiraTable`)** : Sous-onglet dédié dans la page Absences avec filtres par année/mois, champ de paramétrage de la clé Jira, cartes KPI synthétiques et export CSV des rapprochements.
   - **Cartes KPI Stratégiques & Filtres Temporels du Tableau de Bord (Control Tower)** :
     1. **Filtres Temporels** : Filtrage par année et par mois (*Année entière* ou *Mois individuel Janvier...Décembre*).
     2. **Catégories RUN Configurables** : Liste des tags `category` Tempo (défaut `["MCO", "Evol Technique"]`) gérable dans l'écran Administration.
     3. **Double Métrique Équilibre RUN vs BUILD** : Distinction entre la *Projection Planifiée* (type de projet) et le *Réel Tempo Extrait* (champ `category` Tempo).
     4. **Anticipation Absences (M+1)** & **Maturité Chiffrage (B0/B1)**.

### D. Portefeuille Projets & Ventilation Mensuelle (Étape 3)
1. **Modèle Projet** : `codeProjet` (facultatif, avec avertissement visuel d'unicité à la saisie), `nom`, `type` ("RUN" | "Projet" | "Projet Opex" | "Reco" | "Vie d'entreprise"), `epicDomaine`, `leadBA` (référence ressource BA), `priorite` ("P0" à "P4" | null), `statut` ("À l'étude" | "Validé" | "En cours" | "Terminé"), `estimationB0`, `estimationB1`, `epicJiraLie` ("Oui" | "Non" | "NC"), `donneesAJour`.
2. **Modal de Création / Édition de Projet (Design Glassmorphism & Multi-Onglets)** :
   - Formulaire moderne avec bandeau d'en-tête dynamique et badges visuels (priorité, type).
   - **4 Onglets Thématiques** pour une saisie claire et sans surcharge :
     - **« Général & Pilotage »** : Code projet, nom, typologie, domaine/epic, Lead BA, priorité colorée (P0 à P4), statut et notes libres.
     - **« Chiffrage B0 / B1 »** : Cartes visuelles d'estimation avec verrouillage interactif du B0 pour activer le chiffrage fin B1.
     - **« Jira & Tempo »** : Raccordement automatique à la ligne budgétaire, clé Epic et ID Feature.
     - **« Prérequis »** : Gestion des dépendances Fin ➔ Début avec suppression en un clic et compteur dynamique.
   - **Footer d'action fixé** : Boutons "Annuler" et "Enregistrer les modifications" / "Créer le projet".
   - Lors de la soumission, la popin se ferme, rafraîchit les données en temps réel et déclenche un **toaster de notification vert** (`showSuccess`).
3. **Ventilation Mensuelle (`VentilationMensuelle`)** : Ventilée mois par mois en jours **Internes** et jours **Externes** pour chaque projet. La saisie dans le modal individuel s'effectue sous forme de tableau vertical (mois de Janvier à Décembre disposés en lignes) pour un défilement et une saisie fluide. Un endpoint batch (`POST /api/projets/:id/ventilation/batch`) permet d'enregistrer toute l'année en une fois depuis la grille de saisie. Au clic sur le bouton "Enregistrer la ventilation", la popin se ferme automatiquement, déclenche un rafraîchissement complet des données/KPIs et affiche un toaster de succès.
4. **Matrice de Ventilation Globale & Synthèse Capacitive (`MatriceVentilationProjets`)** :
   - Vue consolidée sous forme de sous-onglet dans l'écran Projets ("Vue Matrice Globale").
   - Affiche **les indicateurs capacitifs d'en-tête** puis **tous les projets en ligne** face aux **12 mois de l'année en colonne**.
   - Propose 3 modes de bascule de critères : **Cumul (Total)**, **Interne seul**, **Externe seul**.
   - **Lignes d'indicateurs mensuels synthétiques (en haut du tableau, sous les en-têtes)** :
     - **Jours Ouvrés du Mois** : Nombre de jours travaillés (auto ou forcé avec indicateur ⚡).
     - **Nombre d'ETP Actifs** : Moyenne ETP des ressources (distinction `X.X I / Y.Y E` en mode Cumul).
     - **Capacitif Actuel (Nette en jours)** : `ETP * Jours Ouvrés - Déperdition Absences` (distinction `X.Xj I / Y.Yj E` en mode Cumul).
     - **Production Prévue (Projets en jours)** : Somme des charges ventilées sur les projets (distinction `X.Xj I / Y.Yj E` en mode Cumul).
   - **Section Détail des Projets** : Liste ligne par ligne de tous les projets avec leur ventilation mensuelle et leur total annuel.
   - **Mode Édition Rapide (Saisie Directe en Cellule - Style Excel/Airtable)** :
     - Bouton toggle `[✏️ Édition Rapide (Excel)]` permettant d'éditer directement les ventilations mensuelles en cellule sans ouvrir le modal individuel.
     - **Adaptation au filtre** : Saisie directe de `joursInternes` (si filtre Internes), `joursExternes` (si filtre Externes) ou double champ compact `I:` / `E:` (si filtre Cumul).
     - **Navigation clavier fluide** : Validation et déplacement par `Entrée` (ligne suivante), `Tab` / `Shift+Tab` (mois suivant/précédent), et `Échap` (annulation).
     - **Feedback visuel & Recalcul en temps réel** : Surlignage ambre translucide des cellules modifiées, recalcul instantané des indicateurs et alertes mensuelles ⚠️.
     - **Barre d'action de sauvegarde batch flottante** : Présente un récapitulatif du nombre de projets modifiés avec les boutons *Enregistrer tout* (`POST /api/projets/:id/ventilation/batch`) et *Annuler*.
   - **Feedback Visuel des Surcharges Mensuelles** : Surlignage automatique des colonnes des mois en rouge feutré (`rgba(239, 68, 68, 0.15)`) et alerte `⚠️` dès que la *Production Prévue* excède la *Capacité Nette*.
   - Permet l'ouverture directe du modal de ventilation individuelle au clic sur l'action d'un projet.
5. **Bandeau de Cartes KPI Synthétiques & Filtres de Risques (Onglet "Liste & Chiffrage")** :
   - Présente 5 indicateurs clés récapitulatifs mis à jour dynamiquement :
     - **Total Projets** : Nombre total de projets en portefeuille avec ventilation par statut (*en cours*, *à l'étude*).
     - **Charge Estimée Totale (J.H)** : Cumul des jours/homme des estimations retenues du portefeuille vs total planifié.
     - **Écart Moyen B0 / B1** : Pourcentage de variation moyenne des projets réestimés B0 $\rightarrow$ B1.
     - **Complétude B1 (%)** : Proportion du portefeuille disposant d'un chiffrage affiné B1 (carte cliquable pour filtrer instantanément la liste sur les projets B1).
     - **Suivi des Risques & Alertes** : Nombre cumulé de projets non chiffrés et en dépassement critique (carte cliquable pour filtrer instantanément les projets nécessitant une attention).
   - **Filtre Dédié "Suivi des Risques"** : Un sélecteur dans la barre de filtres permet de filtrer au choix : *Projets à risques (Tous)*, *Dépassements critiques (Rouge)* ou *Projets non chiffrés*.
   - **Mise en valeur visuelle des projets en B1** : Badge vert néon `🔒 B1` avec lueur visuelle et mémoire de la référence B0 initiale `(B0 initial : X j)`.
6. **Gestion des Droits (Client-side)** :
   - **Administrateur / Manager** : Accès complet (création, modification, ventilation et suppression de tout projet).
   - **Lead BA** : Ne peut modifier et ventiler (en modal ou via l'édition rapide) que les projets où il est assigné comme Lead BA (à la création, le projet est automatiquement assigné à son nom).
   - **Lecteur** : Consultation en lecture seule (mode édition rapide masqué).
7. **Vue Kanban du Portefeuille (`PortfolioKanban`) - Gouvernance Agile** :
   - Sous-onglet dédié *"Vue Kanban Agile"* dans la page Portefeuille Projets.
   - **Colonnes dynamiques au choix** :
     - *Statut (Cycle de vie)* : `À l'étude / Cadrage` $\rightarrow$ `Validé / Prêt` $\rightarrow$ `En cours (Actif)` $\rightarrow$ `Terminé / Livré`.
     - *Niveau de Priorité* : `P0 (Critique)` | `P1 (Stratégique)` | `P2 (Moyenne)` | `P3/P4` | `Sans Priorité / RUN`.
     - *Typologie* : `Projets BUILD` | `Projets OPEX` | `RUN & MCO` | `Reco & Vie d'entreprise`.
   - **Drag & Drop interactif en réunion** : Glisser-déposer d'une carte d'une colonne à une autre pour arbitrer ou mettre à jour en direct le statut ou la priorité.
   - **Cartes Projets Riches** : Code projet, badges de priorité et type, domaine/epic, estimations vs planifié J.H, alertes de dérapage critique ⚠️, nom du Lead BA, et actions directes (*Ventiler* et *Éditer*).
   - **Filtres rapides intégrés** : Recherche textuelle, filtre Lead BA et filtre par type.

### E. Moteur d'estimation B0 / B1 & Seuils de Couleurs (Étape 3)
1. **Statut d'estimation** :
   - Si `estimationB1` est renseigné ($>0$) $\rightarrow$ Statut **"B1"** (chiffrage fin retenu).
   - Sinon si `estimationB0` est renseigné ($>0$) $\rightarrow$ Statut **"B0"** (macro-chiffrage retenu).
   - Sinon $\rightarrow$ Statut **"NC"** (non chiffré).
2. **Calcul de la Charge Max Tolérée ($C_{\text{max}}$)** :
   - Mode B0 : $C_{\text{max}} = B0 \times (1 + \text{toleranceB0Pct} / 100)$ (par défaut +100%).
   - Mode B1 : $C_{\text{max}} = B1 \times (1 + \text{toleranceB1Pct} / 100)$ (par défaut +20%).
3. **Indicateurs de Couleur du Statut Capacitif (Pastille B0/B1)** :
   - 🟩 **VERT (Sous l'estimation)** : Total planifié $P \le \text{Estimation Retenue}$ ($B0$ ou $B1$).
   - 🟧 **ORANGE (Dépassement toléré)** : Estimation Retenue $< P \le C_{\text{max}}$ (La charge dépasse l'estimation initiale mais reste sous la charge max tolérée).
   - 🟥 **ROUGE (Dépassement critique)** : $P > C_{\text{max}}$ (La charge excède la charge max tolérée).
   - ⚪ **GRIS (Non chiffré)** : Projet non chiffré ($B0$ et $B1$ absents).
4. **Indicateurs de Progression / Complétude de Saisie (`getCompletudeVentilation`)** :
   - Compare le total planifié (ventilé sur 12 mois) par rapport à l'estimation retenue :
     - 🟢 **100% ventilé** (`badge-success`) : $P = \text{Estimation Retenue} > 0$.
     - 🟡 **Sous-ventilé (X%)** (`badge-warning`) : $0 < P < \text{Estimation Retenue}$.
     - 🔴 **Sur-ventilé (X%)** (`badge-danger`) : $P > \text{Estimation Retenue} > 0$.
     - ⚪ **Non chiffré** (`badge-secondary`) : Projet non chiffré ($\text{Estimation Retenue} \le 0$).
   - **Restitution visuelle** : Colonne dédiée dans la vue *"Liste & Chiffrage"* (`ProjetsPage.tsx`) et sous le nom de chaque projet dans la *"Matrice de Ventilation Globale"* (`MatriceVentilationProjets.tsx`).
5. **Bouton d'activation "Figer B0 / Passer en B1"** :
   - En création/édition, le champ $B1$ n'est déverrouillé qu'après avoir cliqué sur un bouton explicite de figeage du $B0$.
6. **KPI Écart Moyen B0/B1 (`/api/projets/kpi/ecart-b0-b1`)** :
   - Moyenne de $\frac{B1 - B0}{B0}$ sur tous les projets ayant $B0$ et $B1$ renseignés.
7. Tous les calculs de capacité se font **en temps réel (dynamic views)** à partir des données brutes, jamais stockés en dur.

### F. Tableau de bord Macro / Control Tower (Étape 4)
1. **Endpoint d'agrégation Backend (`GET /api/dashboard/control-tower`)** :
   - Réutilise le moteur de capacité backend (`calculerCapaciteMensuelle`) et le référentiel des projets/ventilations.
2. **5 Composants Fonctionnels & Design Glassmorphism / Néon** :
   - **Style Visual Wow (Glassmorphism & Lueurs Néon)** : Cartes translucides floutées (`backdrop-filter: blur(12px)`) avec lueurs néon réactives au survol (`card-neon-blue`, `card-neon-red`, `card-neon-purple`).
   - **Sélecteur de Population & Année** : Permet de basculer instantanément la vue (Jauges, Histogrammes, Camemberts) entre **Global (Cumul)**, **Internes** et **Externes** avec micro-animations fluides de Recharts (`transition: width 0.6s cubic-bezier`).
   - **Cartes KPI B0/B1** : Nombre total de projets, écart moyen B0/B1 (%) et répartition interactive par statut d'estimation (B0, B1, NC).
   - **Jauges de Charge Mensuelles (Taux d'occupation)** : Calcul du taux d'occupation $= \frac{\text{Charge Planifiée}}{\text{Capacité Nette}} \times 100$ pour chaque mois avec barres de progression lumineuses et code couleur (🟩 Vert $<90\%$, 🟧 Orange $90\% \le T \le 100\%$, 🟥 Rouge $>100\%$).
   - **Graphique Capacité vs Charge (Recharts Histogramme Empilé)** : 1 bar par mois empilant la charge par priorité (`RUN` en base, puis `P0` à `P4`, puis `Autres`) avec ligne horizontale pointillée de **Capacité Nette** du mois.
   - **Camemberts de Répartition (Recharts)** : Répartition annuelle du temps planifié **RUN vs BUILD** (Projets), et répartition des charges par priorité **P0 à P4** (hors RUN).
3. **KPIs & Alertes Dynamiques Interactives** :
   - Clic direct sur tout bandeau d'alerte (Dérives B0/B1, Gouvernance P0) ou sur les badges KPI (B0, B1, NC) pour rediriger automatiquement vers la vue filtrée de la **Revue de portefeuille** ou le **Gantt**.
4. **Accès en lecture seule** : Accessible à tous les rôles sans aucune action de modification possible.

### G. Timeline Capacitive, Planning Ressources Split-Screen & Simulation What-If (Étape 5)
1. **Vue Gantt Chronologique & Granularité Temporielle** :
   - Présente tous les projets du portefeuille en ligne avec leur code, nom, type, lead BA et priorité.
   - **Bascule de granularité** : Affichage au choix en **Mois** (12 colonnes), **Trimestres** (Q1 à Q4), **Semestres** (S1 à S2) ou **Semaines (Zoom court terme M / M+1)**.
   - **Mode Semaines chirurgical (Inspiré de Visual Planning)** :
     - Découpage du mois focus en semaines calendaires avec numérotation standard ISO-8601 (`S01` à `S52/S53`) et dates associées.
     - Boutons de raccourcis d'accès rapide **`⚡ M (Mois en cours)`** et **`M+1 (Mois prochain)`** pour accélérer les arbitrages de charge immédiats.
     - Les jalons/milestones précis à la semaine sont positionnés sur leur semaine exacte.
   - **Vue « Planning Ressources » (Gantt nominatif de charge & surbooking individuel)** :
     - Accessible via le sous-onglet dédié *« Planning Ressources (Gantt) »* dans l'écran Timeline.
     - **Réservoir de charge non staffée** en tête de tableau (`Charge Non Staffée`) recensant les jours à affecter mois par mois.
     - **Lignes nominatives par collaborateur** : Avatar circulaire avec initiales, rôle, typologie (`Interne` 🔵 / `Externe` 🟣), quotité ETP et jauge de saturation annuelle globale (`%`).
     - **Double mode de visualisation** :
       - `[Barres Gantt]` : Barres horizontales colorées proportionnelles par projet (dépliables sous chaque collaborateur via accordéons individuels ou boutons globaux `Tout déplier` / `Tout replier`).
       - `[Grille Synthétique]` : Cartes synthétiques mensuelles condensant jours affectés, capacité nette, congés CP et pilules de projets.
     - **Granularité temporelle flexible** : Bascule immédiate entre la vision annuelle `12 Mois` et le zoom chirurgical `🔍 Semaines` sur le mois focus.
     - **Filtrage multidimensionnel épuré** : Recherche textuelle, filtre population (Interne/Externe), rôle et santé de charge (toutes charges, surcharges `>100%`, disponibles `<85%`).
2. **Panier Split-Screen & Staffing Drag & Drop (Inspiré de Visual Planning)** :
   - Volet supérieur toggle `[🛒 Panier Split-Screen]` consolidant la charge orpheline mensuelle par projet, permettant de glisser-déposer un bloc projet sur la cellule d'un collaborateur pour ouvrir instantanément la popin de staffing `QuickStaffingModal` avec contrôle de saturation et recalcul temps réel.
3. **Heatstrip & Jauges de Surbooking Temps Réel (Inspiré de Visual Planning)** :
   - Ruban thermique continu de 12 segments mensuels positionné directement sous la carte d'identité de chaque collaborateur.
   - Code couleur thermique instantané : 🟩 Vert ($<85\%$), 🟧 Ambre ($85-100\%$), 🟥 Rouge vif pulsant ($>100\%$ surbooking), 🟪 Violet ($\ge 50\%$ congés/déperdition).
   - Tooltip d'inspection détaillé au survol de chaque segment et clic direct pour basculer en granularité hebdomadaire (`🔍 Semaines`) sur le mois ciblé.
4. **Bascule Dimensionnelle Instantanée Vue Ressource $\leftrightarrow$ Vue Projet (P4 - Inspiré de Visual Planning)** :
   - **Pivot bidirectionnel à 360°** : Bouton rapide **`[🔄 Vue Projets]`** intégré dans la barre d'outils du planning ressources et bouton symétrique **`[Vue Ressources]`** dans la grille des projets permettant de basculer d'une perspective à l'autre en conservant le contexte temporel (année et mois sélectionnés).
   - **Glisser-Déposer Croisé** : Possibilité de staffer les projets en glissant-déposant soit depuis la palette latérale de ressources vers la cellule d'un projet (`Vue Projets`), soit depuis le panier split-screen vers la cellule d'un collaborateur (`Vue Ressources`), synchronisant immédiatement les ventilations et affectations.
5. **Simulation What-If (Décalage Temporaire & Drag & Drop)** :
   - **Boutons de décalage** : Les boutons fléchés **`◀ -1m`** et **`+1m ▶`** permettent de décaler temporairement la ventilation d'un projet d'un ou plusieurs mois.
   - **Drag & Drop interactif** : Glisser-déposer d'une barre de projet directement vers un autre mois de la grille Gantt pour recalculer le décalage instantanément.
   - **Règle absolue d'isolation** : Les décalages sont calculés **STRICTEMENT en mémoire côté frontend**. Aucun appel API de modification n'est déclenché pendant la phase de test.
   - **Signalement visuel ambre** : Un bandeau d'avertissement permanent (`⚠️ MODE SIMULATION WHAT-IF ACTIF`) et une coloration ambre des lignes et cellules signalent clairement la simulation active.
   - **Feedback capacitif réactif en direct** : Les 12 jauges de charge mensuelles et l'histogramme empilé *Capacité vs Charge* réagissent et se recalculent instantanément à chaque clic ou glisser-déposer sur un projet.
3. **Sauvegarde de Brouillons What-If & Gestion Multi-Scénarios (`/api/simulations`)** :
   - **Enregistrement de Brouillons Nommés** : Permet aux Managers et Lead BAs de sauvegarder leurs décalages de simulation sous forme de brouillons nommés (collection MongoDB `SimulationDraft`) sans altérer la base réelle.
   - **Chargement & Rappel** : Sélection et réactivation en un clic d'un scénario de travail préalablement enregistré depuis la liste déroulante d'en-tête (`📂 Brouillons What-If`).
4. **Comparateur Côte à Côte de 2 Scénarios (`isCompareMode`)** :
   - **Double Restitution Visuelle** : Mode d'affichage comparatif juxtaposant 2 scénarios au choix (ex: *Portefeuille Réel* vs *Brouillon Décalage Q3* ou 2 brouillons distincts).
   - **Double Histogramme Empilé Recharts** : Rendu simultané des 2 trajectoires capacitives côte à côte pour évaluer instantanément les reports de surcharge d'un scénario sur l'autre avant décision finale.
5. **Validation & Annulation explicites** :
   - **Bouton "Annuler la simulation"** : Réinitialise instantanément les décalages en mémoire et restaure l'état réel du serveur sans aucun impact.
   - **Bouton "Appliquer & Enregistrer en base"** : Envoie la nouvelle grille de ventilation réaffectée via l'endpoint batch (`POST /api/projets/:id/ventilation/batch`) pour remplacer la ventilation réelle.
6. **Habilitations Rôles** :
   - Simulation, Drag & Drop, sauvegarde de brouillon et bouton *Appliquer* réservés à l'Administrateur/Manager et au Lead BA sur ses projets assignés.
   - Consultation seule désactivée pour le rôle Lecteur.

### H. Portefeuille Projets Unifié (Synthèse, Matrice & Rapprochement)
1. **Écran Unique Unifié "Portefeuille Projets" (`ProjetsPage.tsx`)** :
   - Regroupe en un point d'entrée unique l'ensemble de la gestion des projets, du chiffrage, de la ventilation capacitive et de la revue du réalisé Jira/Tempo.
   - **3 Sous-onglets intégrés sans doublon** :
     - **« Synthèse & Revue »** : Tableau consolidé de pilotage affichant les attributs projets, estimation B0/B1, planifié (J.H), **réalisé Tempo / Jira** (`consommeTempo` en jours et `%`), badges contributeurs, santé B0/B1 et actions unifiées (`[Ventiler]`, `[Modifier]`, `[Supprimer]`).
     - **Volet Dépliable d'Inspection Détaillée (Expandable Row)** : Clic sur le chevron `▶` / `▼` pour dérouler sous le projet le détail des personnes actives et le temps Jira saisi face au staffing planifié.
     - **« Vue Matrice Globale »** : Grille matricielle sur 12 mois avec édition rapide en cellule (style Excel) et recalcul capacitif temps réel.
     - **« Consommé Tempo vs Planifié »** : Rapprochement approfondi des imputations Tempo par ligne budgétaire et Epic Jira.
   - **Filtres combinables en temps réel** : par recherche textuelle libre, Lead BA assigné, priorité (`P0`–`P4`), statut d'estimation (`B0`/`B1`/`NC`), type (`RUN`/`Projet`/`Reco`/etc.), statut (`À l'étude`/`Validé`/`En cours`/`Terminé`) et suivi des risques (`Critique`, `Dépassements`, `Non chiffrés`).
   - Consultation disponible pour tous les rôles, actions de modification conditionnées aux droits (Admin ou Lead BA assigné).
2. **Système d'Alertes Proactives Backend (`GET /api/dashboard/alertes`)** :
   - **Alerte de Surcharge** (Sévérité Critique 🔴) : Déclenchée pour tout mois où la capacité nette $- \text{charge planifiée} < 0$ (pour Internes et Externes).
   - **Alerte de Dérive B0/B1** (Sévérité Avertissement 🟠) : Déclenchée pour tout projet dont la charge planifiée dépasse sa charge max tolérée ($B0 + \text{tolérance}$ ou $B1 + \text{tolérance}$).
   - **Alerte de Gouvernance** (Sévérité Avertissement 🟠) :
     - Liste les projets de priorité P0 ou P1 sans Lead BA assigné.
     - Détecte les projets P0 encore chiffrés en B0 dont le premier mois de charge planifiée démarre le mois suivant.
   - **Alerte de Sous-charge** (Sévérité Info 🔵) : Déclenchée si la capacité nette disponible excède le seuil de sous-charge configuré (`seuilSousChargeJours`, ex: $+10$j), en suggérant d'arbitrer et de planifier les projets en statut *Reco*.
   - **Restitution UI / Hub d'Alertes Groupées** : Présentation synthétique au sommet du Dashboard regroupant les alertes en cartes compactes par catégorie (Surcharges, Dérives, Gouvernance, Sous-charge) avec accordéons dépliables pour réduire de 80% l'encombrement visuel.
   - **Masquage de Session** : Chaque alerte peut être masquée individuellement dans la session utilisateur sans persistance en base de données.

### I. Ergonomie & Lisibilité des Grilles Denses (Matrice Globale & Gantt)
1. **Mode Compact / Standard (Toggle)** :
   - Bascule interactive permettant d'alterner entre une densité standard d'affichage et une densité compacte.
   - En mode compact, la hauteur des lignes, les tailles de polices et les rembourrages (*paddings*) des cellules sont réduits afin d'optimiser le nombre de projets affichés simultanément à l'écran sans défilement excessif.
2. **En-têtes et Colonnes Collants (*Sticky Headers & Frozen Columns*)** :
   - **Sticky Top Header** : Les en-têtes de colonnes (Mois Jan à Déc, Jours Ouvrés, Capacité Nette, etc.) restent figés en haut de l'écran ou de la grille pendant le défilement vertical.
   - **Sticky Left Column** : La colonne contenant le code et le nom du projet reste bloquée à gauche pendant le défilement horizontal sur les 12 mois de l'année.

### J. Système de Notifications & Feedback Visuel (Toasts)
1. **Toast Notifications Flottantes (Design Néon)** :
   - Gestion centralisée via `ToastContext` & `useToast()`.
   - Affichage en bas à droite de l'écran avec animations fluides d'apparition/disparition et design glassmorphism translucide.
   - 4 typologies visuelles : **Success** (Vert 🟩), **Danger/Erreur** (Rouge 🔴), **Warning** (Ambre 🟧) et **Info** (Bleu 🔵).
2. **Signalement des Actions Clés** :
   - Validation & annulation de simulation What-If sur la Timeline.
   - Changement de rôle utilisateur et ajustement des droits.
   - Importation d'absences et sauvegarde de matrices de ventilation.

### K. Module d'Extraction & Enrichissement des Temps Jira / Tempo
1. **Contexte & Architecture Asynchrone** :
   - Remplacement complet d'un Google Sheet d'extraction de temps par une solution intégrée.
   - **Backend** : Modèle de job asynchrone non-bloquant (`POST /api/tempo/extractions`), flux Server-Sent Events SSE (`GET /api/tempo/extractions/:jobId/events`) avec `heartbeat` émis toutes les 12s, fallback polling (`GET /api/tempo/extractions/:jobId`) et annulation par `AbortController` (`DELETE /api/tempo/extractions/:jobId`).
   - **Fichier de configuration `.env`** : Conservation sécurisée du token Jira (`JIRA_API_TOKEN`), de l'URL (`JIRA_BASE_URL`) et du projet par défaut (`JIRA_DEFAULT_PROJECT`). Le token transitant ou lu dans l'env n'est jamais stocké en BDD MongoDB ni loggué.
   - **Concurrence & Robustesse HTTP** : File d'attente à concurrence limitée (max 5 requêtes simultanées), timeout individuel de 60s et retry exponentiel sur les codes d'erreur HTTP 429 et 5xx.
   - **Période d'extraction par défaut** : Le formulaire d'extraction initialise automatiquement `dateFrom` (`01/01/YYYY`) et `dateTo` (`31/12/YYYY`) sur l'année civile en cours.
2. **Table de Détail à 24 Colonnes & Tableau Croisé Dynamique (TCD) 10 Colonnes** :
   - **Vue Brute (24 colonnes)** : Produit les 24 colonnes structurées dans cet ordre : `budgetLine`, `project`, `issueKey`, `category`, `lot`, `entryTask`, `comment`, `ticketLink`, `collaborator`, `type`, `timeInHours`, `timeInDays`, `estimatedInDays`, `status`, `issueType`, `worklogDate`, `month`, `year`, `epicSummary`, `featureId`, `role`, `labels`, `businessChange`, `fixVersions`.
   - **Règle d'Arrondi Global** : Tous les calculs et affichages de jours/heures (`timeInHours`, `timeInDays`, `estimatedInDays`, sous-totaux INT/EXT/Total) sont arrondis au maximum à **2 chiffres après la virgule**.
   - **Vue Synthèse TCD (10 colonnes A à J - "Détail par Ligne Budget")** : Reproduit fidèlement la cartographie du Google Sheet d'origine avec 2 lignes d'en-têtes (`SUM de timeInDays` / `type` en Ligne 1, `[year, month, budgetLine, category, lot, featureId, entryTask, EXT, INT, Total général]` en Ligne 2). La colonne `entryTask` affiche la tâche brute (`entryTask` de la vue Détail) sous forme d'un lien cliquable ouvrant le ticket Jira dans un nouvel onglet via son `ticketLink`.
   - **Arbre Hiérarchique à 7 Niveaux** : `year > month > budgetLine > category > lot > featureId (avec fallback -100) > entryTask` avec calcul des sous-totaux par niveau (`Total pour 2026`, `Total pour 9`, `Total pour [Produit_0110]`, `Total général`).
   - **Export CSV TCD & Brut** : Génération instantanée des fichiers CSV 24 colonnes et TCD 10 colonnes avec encodage UTF-8 BOM et séparateur point-virgule (format Excel français).
   - **Annuaire Collaborateurs & Mappings Customfields** : Interface de configuration accessible dans l'UI (`/api/tempo/config`), stockée dans la collection MongoDB `TempoConfig` et fusionnée avec la collection `Ressource` (`budgetLine`: `customfield_10806`, `category`: `customfield_10900`).
   - **Résolution Automatique des Utilisateurs Jira & Catégorisation** :
     - Résolution automatique des identifiants anonymisés (`JIRAUSERxxxx`) en vrais Prénoms & Noms complets via l'API profil utilisateur Jira (`/rest/api/2/user?username=...` / `?key=...`) et le support des réponses XML Servlet (`addUserDetails=true`).
     - Matching tolérant et hybride contre la collection `Ressource` par prénom/nom (insensible à la casse, aux accents et à l'ordre des mots) ainsi que par sous-chaîne numérique de matricule.
     - Remplacement dynamique dans la colonne 9 `collaborator` pour afficher le nom propre du collaborateur.
   - **Règles d'extraction & Calcul dynamique du `featureId`** :
     - Valeur par défaut : `"-100"`.
     - Étape 1 (Epic parent) : Regex `/Feature\s*-\s*(\d+)/i` sur l'intitulé de l'Epic Jira (ex: `"Feature - 1668 [...]"` -> `1668`).
     - Étape 2 (Ticket Jira) : Regex `/\#(\d+)/` sur l'intitulé du ticket (ex: `"#1962 [...]"` -> `1962`).
     - Étape 3 (Surcharge Lot 21P090) : Si `lot` vaut `[[21P090]-v1.0-Vente]` et `featureId` vaut `"-100"` ou `"0"`, affecte `"-4"` (si année 2024) ou `"-3"` (pour les autres années).

3. **Persistance MongoDB & Rapprochement Consommé vs Planifié** :
   - **Collection MongoDB `TempoWorklog`** : Les extractions réussies sont sauvegardées sous la collection `TempoWorklog` avec une stratégie **Purge & Replace par plage de dates (`deleteMany` + `insertMany`)** sur la période `[startDate, endDate]`. Cela garantit que toute modification ou suppression dans Jira est répercutée à 100% dans CartOMC sans orphelins.
   - **Chargement par défaut dans l'écran Tempo** : Dès l'accès au menu *"Temps Tempo Jira"*, les données enregistrées en BDD sont automatiquement interrogées via `GET /api/tempo/extractions/saved` et affichées par défaut dans le tableau de détail et le TCD sans nécessiter de relancer une extraction Jira.
   - **Mapping Projet CartOMC ↔ Jira / Tempo** : Le modèle `Projet` intègre les champs optionnels `jiraBudgetLine`, `jiraEpicKey` et `jiraFeatureId`.
   - **Calcul Métier (RAF, Atterrissage & Dérive)** :
     - `Consommé Tempo` = Somme des jours `timeInDays` dans `TempoWorklog`.
     - `Planifié à Date` = Somme de la ventilation mensuelle jusqu'au mois actuel.
     - `Reste À Faire (RAF)` = $\max(0, \text{Estimation Retenue} - \text{Consommé Tempo})$.
     - `Atterrissage Prévisionnel` = $\text{Consommé Tempo} + \text{Planifié Futurs (Mois restants)}$.
     - `Dérive à Date` = $\text{Consommé Tempo} - \text{Planifié à Date}$.
   - **Moteur d'Atterrissage & Suivi Burn-down / Burn-up** :
     - Superposition graphique Recharts 4 courbes : Budget Retenu ($B0/B1$), Trajectoire Planifiée Cumulée CartOMC, Realisé Consommé Cumulé Tempo, et Courbe de Forecast d'Atterrissage.
     - **Triade des Badges de Santé d'Exécution** :
       - 🟩 **VERT (Maîtrisé)** : $\text{Consommé à date} \le \text{Planifié à date}$.
       - 🟧 **ORANGE (Surconsommé à date)** : $\text{Consommé à date} > \text{Planifié à date}$, mais $\text{Atterrissage} \le C_{\text{max}}$.
       - 🔴 **ROUGE (Dérive critique)** : $\text{Atterrissage} > C_{\text{max}}$ ou $\text{Consommé} > \text{Budget}$.
   - **Restitution UI & Control Tower** :
     - Vue dédiée sous-onglet *"Consommé Tempo vs Planifié"* dans l'écran Projets ([`RapprochementTempoTable.tsx`](file:///c:/Users/BL207380/Desktop/Projects/cartomc-capacity/frontend/src/components/RapprochementTempoTable.tsx)).
     - Alerte de dérive de consommation Tempo intégrée au Hub d'Alertes du Dashboard (`GET /api/dashboard/alertes`).

### L. Historisation, Journal d'Audit & Snapshots / Versioning de Portefeuille
1. **Journal d'Audit Automatique (`/api/audit-logs`)** :
   - Traçabilité complète des événements de gestion du portefeuille enregistrés dans la collection MongoDB `AuditLog` :
     - **Passage B0 ➔ B1 (`REESTIMATION_B1`)** : Capture la réestimation initiale B0 vers le chiffrage fin B1.
     - **Création / Modification / Suppression de Projet** : Log de l'auteur (`x-user-role`), de la date/heure et du détail diff champ par champ (anciennes vs nouvelles valeurs).
     - **Enregistrement de Ventilation Batch (`VENTILATION_BATCH`)** : Enregistre les modifications de charge mensuelle réaffectées sur les 12 mois.
     - **Gestion des Snapshots (`SNAPSHOT_CREATION` / `SNAPSHOT_SUPPRESSION`)**.
   - **Interface UI ("Journal d'Audit")** : Vue tabulaire chronologique filtrable par recherche textuelle, type d'action et limite de lignes avec badges de statut et étiquettes de modifications détaillées.
2. **Snapshots & Baselines de Portefeuille (`/api/snapshots`)** :
   - **Gommage / Freeze de Référence** : Permet à l'Administrateur ou Manager de créer un snapshot à un instant $T$ ("Baseline Budget Janvier 2026"), enregistrant l'intégralité des projets (B0, B1, statut, priorités) et leurs 12 mois de ventilation dans la collection MongoDB `PortfolioSnapshot`.
   - **Moteur de Comparaison & Écarts (`/api/snapshots/compare/diff`)** :
     - Compare dynamiquement un état de référence (Baseline ou Portefeuille Réel Actuel) vs une cible.
     - **KPIs d'Écart Macro** : Évolution globale des budgets B0, B1 et du cumul planifié ($\Delta$ en jours/homme avec indicateurs visuels $↗$ / $↘$).
     - **Tableau des Écarts par Projet** : Analyse des évolutions de statut (*Passage B0 ➔ B1*, *Nouveau Projet*, *Projet Retiré*, *Ventilation Modifiée*), des deltas B0/B1/Planifié et accordéon d'analyse des deltas de ventilation mois par mois.
3. **Accès UI & Sidebar** :
   - Nouvel écran dédié **"Historique & Baselines"** (`AuditSnapshotPage.tsx`) accessible depuis le menu latéral via l'onglet `Historique & Baselines` (icône `History`).

### M. Planning des Collaborateurs & Staffing Nominatif (Inspiré de Visual Planning)
1. **Modèle de Ventilation Hybride (Macro + Nominatif)** :
   - Pour chaque projet et chaque mois, la charge planifiée globale est définie par `joursInternes` et `joursExternes`.
   - **Affectations Nominatives (`affectations`)** : Un tableau optionnel de sous-documents `IAffectationRessource` (`ressourceId`, `matricule`, `nom`, `type`, `jours`) permet d'affecter tout ou partie de la charge mensuelle à des collaborateurs identifiés.
   - **Réservoirs de Charge Non Assignée** : Par défaut, la charge ventilée n'a pas d'affectation nominative et alimente le réservoir *"Non assigné"*.
     - $\text{Reste Non Assigné Interne} = \max(0, \text{joursInternes} - \sum \text{affectations internes})$
     - $\text{Reste Non Assigné Externe} = \max(0, \text{joursExternes} - \sum \text{affectations externes})$
2. **Staffing Dépliable dans le Modal de Projet (`ProjetsPage.tsx`)** :
   - Chaque ligne mensuelle propose un chevron et un bouton d'attribution déployant le volet de staffing.
   - L'utilisateur peut ajouter un membre actif de l'équipe, lui affecter un nombre de jours et visualiser le solde restant non assigné en temps réel.
3. **Double Perspective dans la Timeline (`TimelinePage.tsx` & `PlanningRessourcesGantt.tsx`)** :
   - Sélecteur de vue : **`[ 📅 Vue Portefeuille Projets ]`** 🔁 **`[ 👤 Vue Planning Ressources ]`**.
   - En **Vue Planning Ressources (Inspiré de Visual Planning)** :
     - **Ligne Réservoir « 📥 Charge Non Assignée »** : Restitue mois par mois le cumul des jours de projets non encore staffés avec le nom des projets concernés.
     - **Grille Collaborateur $\times$ Mois** : Affiche pour chaque ressource sa capacité nette individuelle ($\text{ETP} \times \text{jours ouvrés} - \text{absences/congés}$), la liste des projets affectés avec leur charge et son taux d'occupation individuel.
     - **Double Mode d'Affichage** :
       - **Mode Barres Gantt (`[📊 Barres Gantt]`)** : Ligne principale de chaque collaborateur avec mini-jauge de charge mensuelle lumineuse (vert, ambre, rouge si surcharge $>100\%$) + sous-lignes horizontales dépliables (`ChevronDown`/`ChevronRight`) affichant chaque projet staffé sous forme d'une barre Gantt colorée selon la typologie et la priorité (`P0` rouge néon, `P1` orange, `RUN` bleu, etc.) avec nombre de jours et lueur d'avertissement. Boutons « Tout déplier » et « Tout replier ».
       - **Mode Grille Synthétique (`[📅 Grille Synthétique]`)** : Cartes mensuelles traditionnelles avec dispo nette, congés et liste de pilules.
     - **Granularité Temporelle & Arbitrage Court Terme (12 Mois 🔁 Semaines)** :
       - Bascule instantanée entre la vue annuelle standard (**12 Mois**) et le zoom chirurgical (**Semaines**).
       - En mode semaine : découpage du mois en semaines calendaires ISO-8601 avec répartition proportionnelle de la capacité et de la charge, complété par les boutons de sélection rapide **`⚡ M (Mois en cours)`** et **`M+1 (Mois prochain)`**.
     - **Code couleur d'alerte individuelle** : 🟩 Vert ($<85\%$), 🟨 Jaune/Ambre ($85-100\%$), 🟥 Rouge ($>100\%$ Surcharge individuelle critique / overbooking).
     - **Filtres de pilotage** : Recherche textuelle, filtre par population (Interne/Externe), rôle et santé de charge (*En surcharge* ou *Avec disponibilité*).
4. **Synchronisation Automatique de la Ventilation depuis Tempo Jira (`/sync-tempo` et `/sync-tempo-global`)** :
   - Lorsqu'un projet dispose d'au moins un identifiant Jira lié (`codeProjet`, `jiraBudgetLine`, `jiraEpicKey`, `jiraFeatureId`), l'utilisateur peut déclencher la synchronisation automatique de sa ventilation depuis les temps réels Tempo.
   - **Calcul automatique de la charge macro** : Pour chaque mois ayant des saisies de temps, `joursInternes` et `joursExternes` sont automatiquement alimentés à partir de la somme des `timeInDays` des collaborateurs correspondants.
   - **Génération automatique du staffing nominatif** : Les collaborateurs reconnus dans le référentiel `Ressources` sont automatiquement ajoutés dans les `affectations` du mois avec leurs jours réels consommés.
   - **Bouton d'action individuel** : Bouton `[⚡ Remplir depuis Tempo]` dans la barre d'outils du modal de ventilation mensuelle.
   - **Bouton d'action global de portefeuille** : Bouton `[⚡ Synchroniser tout depuis Tempo]` situé dans l'en-tête de l'écran *Portefeuille projets*, permettant d'itérer sur l'ensemble des projets du portefeuille et de synchroniser d'un seul clic toutes les ventilations et affectations de ressources à partir des worklogs Tempo.
5. **Vue Détaillée "Projets & Affectations par Ressource" (`RessourceProjetsView.tsx`) - Suivi 360° Staffé vs Réalisé Jira** :
   - Troisième sous-onglet intégré dans l'écran *Ressources* (`[👥 Référentiel] | [🏖️ Suivi des absences] | [📂 Projets & Affectations]`).
   - **Filtres temporels** : Bascule dynamique entre *Année entière* ou un *Mois individuel (Janvier à Décembre)*, filtres par type (Interne/Externe), rôle et recherche textuelle.
   - **Annuaire des collaborateurs (Gauche)** : Liste interactive restituant pour chaque collaborateur son volume staffé et son réel Tempo (`X j / Y j`), son nombre de projets et son statut.
   - **Fiche Collaborateur & Confrontation Réel vs Prévu (Droite)** : 
     - **4 KPIs synthétiques** :
       - *Capacité nette disponible* ($X\text{j}$)
       - *Staffé CartOMC* ($X\text{j}$ et $\%$ de couverture)
       - *Réel Jira Tempo* ($X\text{j}$ et $Y\text{h}$, $\%$ consommé)
       - *Écart Net Réel vs Staffé* ($\Delta$ en jours, ambre si excédent, cyan si sous-consommation).
     - **Tableau détaillé d'Activité & Projets** :
       - Liste tous les projets staffés ainsi que les activités Jira imputées.
       - Colonnes dédiées : **Staffé CartOMC**, **Réel Jira** ($X\text{j}$ / $Y\text{h}$), **Écart** ($\pm \Delta\text{j}$) et **Part Réelle**.
       - **Détection des activités "Hors Staffing"** : Badge néon `⚡ Hors staffing` pour les projets/activités sur lesquels le collaborateur a imputé des heures Jira sans avoir été prévu dans CartOMC (travail fantôme/dépannages).
       - **Mini-grille 12 mois bi-couleur** : Visualisation simultanée des mois avec temps staffé (cyan) et temps réel Jira (vert néon).

6. **Indicateurs de Staffing & Anomalies sur le Tableau de Bord (`DashboardPage.tsx`)** :
   - **Indicateur 1 - Taux de Couverture Nominative** : Ratio entre les jours affectés à des collaborateurs nommés et la charge planifiée totale des projets (% global, part Interne vs Externe et volume du réservoir non assigné).
   - **Indicateur 2 - Écart Affecté vs Réel Tempo** : Détection des dérives en comparant sur le mois cible les prévisions nominatives aux temps réels déclarés dans Tempo (delta en jours et en %).
   - **Indicateur 3 - Hub d'Alertes Staffing & Affectations** : Catégorie dédiée dans le Hub d'alertes proactives remontant :
     - Les projets prioritaires (P0/P1) à déficit de staffing démarrant sous 60 jours (> 70% non assigné).
     - Les collaborateurs en surcharge nominative critique (> 110% de leur capacité nette mensuelle).
   - **Indicateur 4 - Graphique Trajectoire Staffing Mensuelle 3 Volets** : Visualisation mensuelle comparant côte à côte le *Planifié Total Projets*, le *Staffé Nominatif* et le *Consommé Réel Tempo* (sur les mois passés et en cours).

7. **Regroupement Hiérarchique Style Visual Planning (P2 - Timeline Gantt & Matrice Globale)** :
   - **Sélecteur "Grouper par"** : Disponible dans la barre d'outils de la vue Timeline Gantt et de la Matrice Globale de ventilation (`Aucun`, `Domaine / Epic`, `Lead BA`, `Priorité`, `Type de projet`).
   - **Lignes Synthétiques d'En-têtes de Groupes** :
     - Affiche l'icône dossier/chevron d'arborescence, le nom du groupe et un badge avec le compteur de projets associés.
     - **Enveloppe Macro sur le Gantt** : Barre d'enveloppe synthétique cyan couvrant toute la période active du groupe (du premier mois au dernier mois des projets enfants) avec jauge d'avancement et total annuel en jours.
     - **Sous-totaux Périodiques sur la Matrice** : Calcul et affichage en temps réel des sous-totaux par mois/trimestre/semestre et total annuel pour chaque groupe.
   - **Boutons "Tout déplier" / "Tout replier"** : Permettent d'ouvrir ou fermer d'un simple clic l'ensemble des dossiers pour offrir une vision macro-synthétique ou détaillée immédiate.
   - **Repliement Accordéon Individuel** : Clic sur chaque en-tête pour replier ou déplier les projets enfants correspondants, avec indentation visuelle soignée.

---

8. **Palette Latérale de Staffing & Drag-and-Drop Nominatif Direct (Axe 1 - Style Visual Planning)** :
   - **Tiroir / Palette Latérale Rétractable (`ResourceDrawer.tsx`)** :
     - Volet latéral escamotable avec onglet vertical permanent (`👤 Staffing Nominatif`) et bouton toggle dédié dans la barre d'outils de la Timeline (`👤 Palette Staffing`).
     - Liste interactive et filtrable (recherche textuelle par nom/rôle/matricule et filtres population *Tous / Interne / Externe*) de l'ensemble des collaborateurs actifs de l'équipe.
     - Chaque collaborateur est une carte *draggable* avec poignée (`grip`), badge de population, rôle et taux d'activité ETP.
     - **Jauges d'Occupation Intégrées sous chaque Carte Collaborateur** :
       - Sélecteur de mois focus dans l'en-tête du drawer permettant d'observer la saturation sur le mois courant ou charnière ciblé.
       - Affiche sous chaque collaborateur une barre de progression avec volume affecté vs capacité nette ($X\text{j} / Y\text{j}$) et pourcentage de saturation ($\%$) :
         - Vert ($\le 85\%$) : Disponible 🟢
         - Ambre ($85\% - 100\%$) : Charge optimale 🟠
         - Rouge ($> 100\%$) : Surcharge critique 🔴 avec témoin d'avertissement ⚠️.
       - Permet au Lead BA d'identifier en un coup d'œil les collaborateurs disponibles avant même de démarrer le glisser-déposer.
   - **Interaction de Glisser-Déposer (`HTML5 Drag & Drop`)** :
     - Au survol d'une cellule mensuelle d'un projet dans la Timeline Gantt, la cellule s'illumine avec pulsation cyan (`drop-target-active`).
     - Le drop d'une ressource sur un mois déclenche automatiquement le micro-modal d'affectation rapide (`QuickStaffingModal.tsx`).
   - **Micro-Modal d'Affectation Rapide (`QuickStaffingModal.tsx`)** :
     - Récapitule le nom de la ressource, le rôle, le projet ciblé et le mois concerné.
     - Affiche le volume de jours déjà affecté (le cas échéant) et permet de saisir les jours souhaités (avec boutons d'accès rapide 2.5j, 5j, 10j, 15j, 20j).
     - Enregistrement immédiat via l'endpoint batch (`POST /api/projets/:id/ventilation/batch`), recalcul automatique de la charge macro si nécessaire pour englober le staffing, et notification toaster de succès.

---

9. **Jalons Clés & Milestones sur le Gantt (`JalonsManagerModal.tsx`)** :
   - **Modèle de Données & Typologie** : Chaque projet peut intégrer une liste de sous-documents `jalons` (`nom`, `mois` de 1 à 12, `semaine` optionnelle de 1 à 53 selon standard ISO 8601, `annee`, `type` (*MEP*, *UAT*, *CADRAGE*, *GONO*, *AUTRE*), `couleur`).
   - **Saisie Granulaire à la Semaine ou au Mois** :
     - Dans le modal de gestion (`JalonsManagerModal.tsx`), un commutateur permet de choisir la précision : **Mois** (macro) ou **Semaine** (chirurgicale).
     - En mode semaine, le système calcule automatiquement les semaines ISO du calendrier annuel correspondant au mois cible (ex: `S40 (1-7 Oct)`, `S41 (8-14 Oct)`...).
   - **Bouton d'Action Rapide sur la Timeline** : Bouton drapeau `🚩 [N]` situé directement à côté du nom de chaque projet dans le tableau Gantt. Le badge s'illumine en rouge avec le compteur de jalons enregistrés.
   - **Restitution Visuelle sur la Grille Gantt (Mois & Semaines)** :
     - Les jalons s'affichent sous forme de **losanges colorés néon** (`transform: rotate(45deg)`).
     - En vue mensuelle, les losanges se positionnent sur la cellule du mois ciblé.
     - En vue **🔍 Semaines**, chaque jalon vient se loger **exactement sur la colonne de sa semaine ISO cible**, offrant une précision chronologique parfaite.
     - Au survol, une infobulle enrichie détaille l'intitulé, le type et la semaine ISO du jalon.
     - Un simple clic sur le losange ouvre directement le gestionnaire de jalons du projet.

10. **Granularité Temporelle & Zoom Semaine (`TimelinePage.tsx`)** :
    - **Sélecteur Multi-Échelles** : Propose 4 modes de granularité : **🔍 Semaines**, **Mois (12)**, **Trimestres (Q1-Q4)** et **Semestres (S1-S2)**.
    - **Zoom Semaine avec Numérotation Annuelle ISO 8601 (S01 à S52/S53)** :
      - En mode *Semaines*, un sélecteur de mois focus permet de cibler un mois charnière particulier (ex: Octobre 2026).
      - La grille calcule les vrais numéros de semaine du calendrier annuel (standard ISO 8601 : ex: `S40 (1-7 Oct)`, `S41 (8-14 Oct)`, `S42 (15-21 Oct)`, `S43 (22-28 Oct)`, `S44 (29-31 Oct)`).
      - La charge du mois est répartie de façon proportionnelle sur les semaines avec maintien des totaux et synthèse de groupe.
      - Supporte le glisser-déposer de staffing et l'affichage des losanges de jalons.

11. **Fiche 360° Synthétique au Survol / Tooltips Enrichis (`Project360Tooltip.tsx` - Style Visual Planning)** :
    - **Déclenchement & Ergonomie Réactive** :
      - S'active au survol du nom du projet ou de n'importe quelle barre de charge sur le Gantt de la Timeline.
      - Micro-temporisation anti-scintillement (120ms) et désactivation automatique pendant les opérations de drag-and-drop.
      - Positionnement dynamique auto-ajusté (évite les sorties d'écran en bas et à droite).
    - **Contenu Synthétique 360°** :
      1. **Identité & Cadrage** : Code projet, nom complet, type, priorité et nom du **Lead BA** (avec domaine / epic).
      2. **Chiffrage B0 / B1 vs Planifié** : Charge retenue ($X\text{ j}$), charge max tolérée avec seuil de tolérance en pourcentage, et total planifié consolidé.
      3. **Réalisé Tempo & Trajectoire** : Volume consommé Tempo réel extrait sur l'année, planifié à date et atterrissage prévisionnel (avec référence de ligne budgétaire Jira).
      4. **Principales Ressources Staffées Nominativement** : Liste des collaborateurs affectés sur le projet (badge Interne/Externe et volume de jours attribués).
      5. **Santé Globale** : Badge d'état coloré instantané (*Maîtrisé Tempo*, *Surconsommé à date*, *Dérive critique*, ou *Conforme Budget*).

12. **Détection Proactive & Alerte de Conflits de Staffing en Temps Réel (`QuickStaffingModal.tsx` - Axe 4)** :
    - **Calcul Dynamique de Saturation Multi-Projets** :
      - Dès l'ouverture du modal d'affectation rapide (au drop d'une ressource sur un projet/mois), l'application analyse les affectations de la ressource sur **tous les autres projets** pour le mois sélectionné face à sa capacité nette réelle ($\text{Jours ouvrés} - \text{Absences}$).
      - Affiche le détail des autres projets sur lesquels le collaborateur est déjà engagé ($N\text{ j}$ par projet).
    - **Alerte Visuelle & Taux d'Occupation Immédiat** :
      - Dès la frappe du nombre de jours dans le champ de saisie, le système calcule le taux d'occupation résultant ($\%$).
      - Si le total excède la capacité nette (ex: $> 100\%$), une alerte rouge vive clignotante s'affiche immédiatement :
        *"Attention : Conflit de staffing ! Collaborateur déjà staffé à 110% sur ce mois (X j affectés pour Y j de capacité nette, soit un dépassement de +Z j)"*.
      - Le bouton principal bascule visuellement en mode d'arbitrage conscient (`[Forcer / Enregistrer]`).

13. **Commentaires et Notes d'Arbitrage sur les Projets / Mois (`NoteArbitrageModal.tsx` - Axe 4)** :
    - **Persistance & Modèle** : Le champ `noteArbitrage` est rattaché à la ventilation mensuelle du projet (`VentilationMensuelle.ts`).
    - **Marqueur d'Angle Visuel Style Excel / Airtable** :
      - Chaque cellule de mois dotée d'une note d'arbitrage arbore un **coin replié ambre translucide** (`border-top / border-right`) dans l'angle supérieur gauche.
      - Au survol du marqueur, une infobulle native restitue immédiatement le texte de la note (ex: *"Décalé à septembre en attente arbitrage métier COPROJ du 15/03"*).
    - **Édition Rapide & Ergonomie** :
      - **Double-clic** direct sur n'importe quelle cellule du Gantt pour ouvrir la popin d'arbitrage.
      - Bouton bulle contextuel `💬` disponible à côté de l'intitulé du projet dans la colonne de gauche (s'allume en ambre lorsqu'au moins une note existe sur l'année).
      - Popin dédiée avec horodatage, modification ou suppression en un clic (`POST /api/projets/:id/ventilation/batch`).

14. **Jauge d'Occupation Intégrée sous les Cartes du Drawer de Staffing (`ResourceDrawer.tsx`)** :
    - **Calcul de Disponibilité Immédiate** :
      - Pour chaque ressource listée dans la palette latérale rétractable de staffing, calcul en temps réel de son taux d'occupation sur le mois actuellement affiché dans la Timeline.
      - Taux d'occupation = $\frac{\text{Total jours affectés sur tous les projets du mois}}{\text{Capacité nette du collaborateur sur le mois}} \times 100$.
    - **Restitution Visuelle Néon** :
      - Mini-barre de progression intégrée directement sous chaque carte collaborateur.
      - Code couleur adaptatif : 🟢 Vert ($<80\%$), 🟡 Jaune/Ambre ($80\% - 100\%$), 🔴 Rouge ($>100\%$).
      - Libellé synthétique : ex. `14.0j / 20.0j (70%)` ou `22.0j / 20.0j (110%)`.
      - Permet au Lead BA d'identifier en un coup d'œil qui est disponible avant de glisser-déposer la ressource.

15. **Indicateur de Jalons Imminents sur le Dashboard / Hub d'Alertes à J-30 (`DashboardPage.tsx` & `dashboard.ts`)** :
    - **Détection Automatique (J-30 / Mois en cours & M+1)** :
      - Le backend analyse l'ensemble des projets porteurs de jalons (`MEP`, `UAT`, `CADRAGE`, `GONO`, `AUTRE`) planifiés sur le mois courant ou le mois suivant.
      - Évalue automatiquement la **santé globale du projet associé** :
        - 🟢 `VERT` : Charge planifiée conforme à l'estimation ($B0$ ou $B1$).
        - 🟡 `ORANGE` : Charge planifiée dans la marge de tolérance.
        - 🔴 `ROUGE` : Dépassement de la charge maximale tolérée.
        - ⚪ `NC` : Projet non chiffré.
    - **Tuile Dédiée dans le Hub d'Alertes Proactives** :
      - Groupe spécifique : `Jalons Clés & Milestones Imminents (J-30)` avec icône drapeau 🚩 rose néon (`#ec4899`).
      - Chaque alerte affiche le type de jalon (`MEP`, `UAT`, etc.), l'échéance temporelle (*Ce mois-ci* ou *Le mois prochain*), le nom du projet, la priorité, et un badge clair de l'état de santé du projet.
      - Lien direct cliquable `Voir sur le Gantt ➔` redirigeant vers la Timeline.

16. **Rapport d'Arbitrage & Synthèse des Notes / Export COPROJ & COPIL (`RapportArbitrageModal.tsx` & `TimelinePage.tsx`)** :
    - **Sous-Filtre Dédié sur la Timeline** :
      - Sélecteur de filtre direct dans la barre du Gantt : `💬 Arbitrages : Tous`, `💬 Avec notes (Année)`, ou `💬 Avec notes (Trimestre en cours)`.
      - Permet d'animer une séance de comitologie directement sur le Gantt en n'affichant que les projets faisant l'objet d'un arbitrage.
    - **Vue Consolidée & Panneau Dédié (`[📋 Synthèse des Arbitrages]`)** :
      - Bouton d'accès direct dans la barre d'outils supérieure de la Timeline ouvrant un modal dédié en néon ambre/violet.
      - Filtre temporel instantané par trimestre ($Q1, Q2, Q3, Q4$), mois spécifique ou année complète, avec barre de recherche en texte intégral.
      - Liste chronologique des projets avec leur priorité, nom, Lead BA, mois, charge planifiée et note textuelle intégrale.
      - Clic sur un projet pour le cibler immédiatement dans la grille du Gantt.
    - **Exports Clés en Main pour Comités de Pilotage** :
      - **Export Excel / CSV** : Fichier encodé en UTF-8 BOM avec séparateurs point-virgule contenant toutes les métadonnées et notes d'arbitrage.
      - **Copie Presse-Papier en 1 Clic** : Texte structuré prêt à l'emploi avec puces et sauts de ligne pour e-mails de compte-rendu ou canaux Teams/Slack.

---

17. **Liens de Dépendance Légers & Alertes de Conflits Chronologiques (Inspiré de Visual Planning)** :
    - **Modèle de Données & Relation Fin ➔ Début (`dependances`)** :
      - Chaque projet peut déclarer une liste de dépendances vers des projets prérequis (`IDependanceProjet` : `projetId`, `codeProjet`, `nom`, `typeLien = 'FIN_DEBUT'`).
      - Règle chronologique : un projet successeur ne doit pas démarrer avant le dernier mois de production de son prérequis ($M_{\text{début}}(\text{Successeur}) > M_{\text{fin}}(\text{Prérequis})$).
    - **Formulaire & Gestion dans le Modal Projet (`ProjetsPage.tsx`)** :
      - Section dédiée *« 🔗 Dépendances & Projets Prérequis (Fin ➔ Début) »* permettant d'ajouter ou retirer des projets prérequis via une liste déroulante filtrée excluant le projet lui-même et les doublons.
    - **Restitution Visuelle & Badges dans les Vues** :
      - **Vue Synthèse Projets (`ProjetsPage.tsx`)** : Badge bleu cyan `🔗 N prérequis` au survol pour consulter instantanément les projets indispensables au lancement.
      - **Fiche 360° au Survol (`Project360Tooltip.tsx`)** : Bloc dédié *« Prérequis obligatoires »* listant les dépendances avec codes projets et intitulés.
      - **Vue Timeline Gantt (`TimelinePage.tsx`)** :
        - Badge dynamique sur la ligne de chaque projet : `🔗 N prérequis` ou clignotant rouge `⚠️ Conflit` dès qu'une incohérence de calendrier est détectée.
        - Filtre rapide `[🔗 Dépendances]` dans la barre d'outils pour isoler uniquement les chantiers liés par une chaîne de dépendances.
    - **Tracé Graphique SVG Interactif des Dépendances & Conflits (`GanttDependencyLinks.tsx` - P2 Inspiré de Visual Planning)** :
      - Calque SVG superposé à la grille du Gantt traçant les connecteurs physiques Fin ➔ Début entre projets.
      - **Codes couleurs thermiques dynamiques** :
        - 🔵 **Lien nominal (Sain)** : Ligne cyan translucide en tiretés (`#06b6d4`) avec flèche orientée.
        - 🟡 **Tension de calendrier** : Ligne ambre (`#fbbf24`) lorsque le successeur démarre le même mois que la fin du prérequis.
        - 🔴 **Conflit critique** : Ligne rouge vif néon continue (`#f43f5e`) avec pulsation lumineuse, badge `!` centré et boucle d'avertissement.
        - 🟣 **Lien au survol (Focus)** : Surlignage violet néon (`#c084fc`) au survol d'une ligne de projet pour isoler sa chaîne de dépendances.
      - **Bouton & Sélecteur dans la barre d'outils** :
        - Bouton toggle `[🔗 Flèches SVG]` permettant d'afficher ou masquer les flèches.
        - Sélecteur de mode : *`🔗 Tous les liens`*, *`🚨 Conflits seuls`* (vue crise) ou *`🎯 Projet survolé`* (mode épuré).
      - **Interactivité What-If** : Déplacement interactif des flèches en direct lors du glisser-déposer d'un projet ou de son décalage avec les boutons `◀ -1m` / `+1m ▶`.
      - **Navigation rapide au clic** : Clic sur une flèche pour focaliser et scroller automatiquement vers le projet successeur.
    - **Détection des Conflits en Temps Réel & Décalage en Cascade (Mode What-If)** :
      - Dès qu'un projet est décalé par drag & drop ou par les boutons `◀ -1m` / `+1m ▶`, l'application calcule instantanément les chevauchements avec ses successeurs.
      - **Bandeau d'Alerte Rouge Dédié** : Signalement immédiat du nombre de conflits avec détail clair (ex: *« Projet B démarre en M05 avant la fin de Projet A (M06) »*).
      - **Bouton d'Arbitrage Automatique « Décaler en cascade »** : Un clic suffit pour répercuter le décalage nécessaire sur l'ensemble de la chaîne des successeurs en mémoire frontend.
    - **Hub d'Alertes Proactives du Tableau de Bord (`DashboardPage.tsx` & `/api/dashboard/alertes`)** :
      - Catégorie dédiée *« Conflits & Tensions de Dépendance »* (icône `Link2`, rose vif néon `#f43f5e`) alertant les managers et Lead BAs des incohérences de planification existantes sur l'année.

18. **Vues & Filtres Sauvegardés / Workspaces (Style Visual Planning)** :
    - **Principe & Ergonomie** :
      - Composant réutilisable `WorkspaceManager` intégré sur l'ensemble des écrans porteurs de filtres (`TimelinePage`, `ProjetsPage`, `DashboardPage`, `RessourcesPage`, `AuditSnapshotPage`).
      - Permet à chaque utilisateur de mémoriser ses configurations de filtres préférées (par profil / Lead BA), d'y accéder en 1 clic et de basculer instantanément sans recharger la page.
    - **Stockage Scruté par Profil (LocalStorage)** :
      - Persistance locale dans le navigateur sans configuration serveur, isolée par rôle et par identifiant de Lead BA (`cartomc_workspaces_<page>_<role>_<leadId>`).
    - **Préréglages d'Usine Recommandés (System Presets)** :
      - **Timeline Gantt** : *Comitologie / Arbitrages COPROJ* (avec notes actives), *Chaînes Critiques* (dépendances actives), *Vue Lead BAs Référents* (groupement Lead BA), *Zoom Opérationnel Semaines*.
      - **Portefeuille Projets** : *Projets Stratégiques (P0 / P1)*, *Alertes & Dépassements*, *Chantiers En Cours*, *Mon Périmètre* (auto-ciblé sur le Lead BA connecté).
      - **Tableau de Bord** : *Vue Globale Annuelle*, *Capacité Internes Seuls*, *Focus Mois Courant*.
      - **Ressources** : *Collaborateurs Internes*, *Prestataires Externes*, *Profils Lead BA*.
      - **Audit & Comparateur** : *Passages B0 ➔ B1*, *Ventilations Modifiées*, *Nouveaux Projets Entrants*.
    - **Gestion Personnalisée** :
      - Bouton `[Enregistrer la vue actuelle...]` avec saisie de nom personnalisé.
      - Suppression individuelle de vue en un clic (`Trash2`).
      - Bouton rapide `[Reset]` pour réinitialiser tous les filtres aux valeurs par défaut de l'écran.

19. **Suivi des Versions & Jalons Opérationnels (`VersionsPage.tsx`, `VersionMilestone.ts`)** :
    - **Synchronisation avec Jira (`fixversions` & `released`)** :
      - Exploitation automatique des objets `fixVersions` issus de l'API Jira et des extractions Tempo.
      - Récupération du statut de publication Jira (`released: true/false`, `archived: true/false`).
      - Filtre instantané dans l'interface : **`[🟢 Non publiées (Actives)]`** (par défaut), **`[⚪ Publiées (Releases)]`**, et **`[Toutes]`**.
    - **Gestion Complète des 6 Jalons Opérationnels (CRUD)** :
      1. 🛑 *Date fin « À faire »* : Interdiction d'embarquer/démarrer de nouveaux tickets.
      2. 🛑 *Date fin « En cours »* : Clôture du développement / interdiction de commiter.
      3. 🛑 *Date fin « MR »* : Freeze de code / branches fusionnées.
      4. 🛑 *Date fin « Recette »* : Tests QA et validations métier achevés.
      5. 🚀 *Date de « MEPP »* : Déploiement en préproduction & bancs d'essais / benchmarks.
      6. 🎯 *Date de « MEP »* : Déploiement en production finale.
      - Possibilité de modifier, supprimer individuellement chaque jalon ou vider l'ensemble.
      - Assistant de rétro-planning automatique : calcule automatiquement les jalons antérieurs à partir de la date de MEP.
    - **Moteur d'Alertes de Non-Conformité & Préconisations de Décalage** :
      - Détection automatique des tickets en retard ou bloquants par rapport aux jalons échus (ex: ticket encore « À faire » après le jalon fin À faire).
      - Recommandations d'arbitrage immédiates avec bouton de copie des clés Jira pour reporter facilement les tickets dans Jira.
    - **Double Restitution Visuelle** :
      - *Vue Cartes & Pipeline* : Stepper interactif des 6 jalons, badge de santé globale (Vert/Orange/Rouge), répartition des tickets par statut.
      - *Vue Calendrier Mensuel* : Visualisation des jalons de toutes les versions sur un calendrier interactif avec numéros de semaine ISO-8601.
    - **Tri Intelligent & Dynamique des Versions (`VersionsPage.tsx`)** :
      - **Tri Chronologique MEP par Date Pivot** : Les versions dont l'échéance de MEP est à venir ($\ge$ Date du jour) sont classées en tête par ordre chronologique croissant (la plus proche en premier). Les échéances passées ($<$ Date du jour) sont automatiquement reléguées en bas de liste, suivies des versions sans date renseignée.
      - **Tri par Tickets en Cours** : Sélecteur de tri dédié (`Tickets En cours - Plus élevé` / `Moins élevé`) et tuile KPI interactive cliquable en 1 clic pour isoler les releases ayant le plus de chantiers actifs.
      - **Autres options de tri** : Par total de tickets, nombre d'anomalies/alertes, ou nom alphabétique.
    - **Système de Pagination des Versions (`VersionsPage.tsx`)** :
      - **Pagination réactive en mode Cartes** : Découpage de la liste des versions pour fluidifier la navigation sans alourdir le DOM.
      - **Sélecteur de taille de page** : Choix personnalisable entre **5, 10, 20 ou 50 versions par page** (valeur par défaut : 10).
      - **Barre d'outils de pagination complète** : Affichage du décompte (« *Affichage de X à Y sur Z versions* »), boutons *Première page*, *Précédent*, numéros de page avec ellipses dynamiques (`...`), *Suivant*, et *Dernière page*.
      - **Remise à zéro automatique** : Rebascule automatique à la page 1 lors de toute modification des filtres (Recherche, Statut de publication, Tri ou Taille de page).
    - **Reconnaissance du statut "Technical Validation" (Revue)** :
      - Mappage des libellés Jira `Technical Validation`, `tech validation`, `validation technique` sur l'étape de validation technique/MR avec badge violet dédié (`#c084fc`).
    - **Popin Détaillée des Tickets Élargie & Plein Écran (`VersionTicketsModal.tsx`)** :
      - **Largeur optimisée (1360px) et Mode Plein Écran (Toggle `[⛶ Plein écran]` à 98vw)** garantissant l'affichage sans défilement étouffé de toutes les colonnes (*Clé*, *Résumé*, *Assigné*, *Statut Jira*, *Temps*, *Diagnostic Jalon*).
      - **Mise en valeur critique du statut "Blocked"** :
        - Les tickets avec statut `Blocked` / `Bloqué` sont classés **prioritairement tout en haut de la liste**.
        - Badge de statut rouge vif néon (`#ef4444`) avec icône ⛔ et contour rouge.
        - Ligne du tableau teintée en rouge d'alerte avec bordure gauche de 4px (`borderLeft: 4px solid #ef4444`).
      - **Système de Pagination Intégré à la Popin** :
        - Découpage paginé des tickets Jira (défaut : **15 tickets par page**, options à 10, 15, 25, 50, 100).
        - Barre de navigation fixée en pied de modale : compteur dynamique (« *Affichage de X à Y sur Z tickets* »), boutons *Première*, *Précédent*, numéros de page avec ellipses, *Suivant*, et *Dernière*.
        - Réinitialisation instantanée à la page 1 lors de l'application de filtres rapides (ex: Bloqués, Anomalies, À décaler, Terminés), recherche textuelle ou changement de taille de page.
      - **Vue Dédiée des Tickets Orphelins (Sans Version)** :
        - Endpoint dédié `GET /api/versions/unassigned/tickets?projectKey=...` détectant tous les tickets sans version (`fixVersions` vide, `null`, `NC`, ou `Sans version`).
        - **Tuile KPI interactive `[Sans version]`** dans l'en-tête et bouton dédié **`[⚠️ Sans version (N)]`** dans la barre de filtre.
        - Ouvre la popin avec vue complète, tri par statut, filtres et recherche pour identifier immédiatement les tickets oubliés ou à affecter.

20. **Calendrier des Jalons Opérationnels sur le Dashboard (`DashboardVersionsCalendar.tsx` & `DashboardPage.tsx`)** :
    - **Synchronisation Temporelle Automatique avec le Dashboard** :
      - **Mode Zoom Mensuel** : Si l'utilisateur sélectionne un mois précis (ou via les raccourcis *Mois en cours*, *Q1..Q4*), le calendrier n'affiche que le mois sélectionné avec toutes ses échéances détaillées.
      - **Mode Vue Annuelle** : Si l'utilisateur choisit *Année entière*, le calendrier bascule sur une grille responsive synthétique découpée en **12 mois**, avec bouton de zoom individuel sur chaque mois.
    - **Numéros de Semaine ISO-8601 (`Sem.`)** : Chaque ligne de semaine intègre une colonne dédiée calculant et affichant le numéro de semaine exact (`S1..S53`) selon la norme internationale ISO-8601.
    - **Restitution des 6 Jalons Clés de Version** : Badges néons colorés (Fin À faire, Fin En cours, Fin MR / Tech Validation, Fin Recette, MEPP, MEP).
    - **Filtres Contextuels & Interactivité** : Filtre par version, par type de jalon, légende cliquable, et ouverture immédiate de la modale d'édition ou de détail des tickets au clic sur un jalon.
    - **Double Emplacement** : Directement dans l'onglet principal *"Vue d'Ensemble & KPIs"* et dans l'onglet dédié *"📅 Calendrier des Jalons"*.

21. **Module de Rapports & Pilotage Capacitif des Versions (`VersionReportsView.tsx` & `/api/versions`)** :
    - **Onglet Dédié `[📊 Rapports]` dans le Suivi des Versions** :
      - Accessible aux côtés des vues *Cartes* et *Calendrier*, extensible pour de futurs graphiques analytiques.
      - **Sélecteur de Version Cible ordonné à l'identique de la vue Cartes** : Tri chronologique à partir d'aujourd'hui (échéances MEP à venir en premier par ordre croissant, puis échéances passées, puis versions sans date).
    - **Burnup Chart en Jours/Homme (Effort Estimé vs Consommé Réel)** :
      - Endpoint dédié `GET /api/versions/:id/burnup`.
      - **Axe temporel par semaine calendaire ISO** (`YYYY-Sxx`).
      - **Courbe Périmètre Estimé (Scope en J)** : Somme des estimations initiales des tickets de la release.
      - **Courbe Consommé Cumulé Réel (Tempo en J)** : Suivi cumulatif des jours travaillés au fil des semaines.
      - **Trajectoire Idéale Linéaire** : Projection de référence reliant le lancement au jalon cible de MEP.
      - **KPIs synthétiques de release** : Périmètre estimé, Total consommé réel, Reste à faire théorique et ratio d'écart / dérive (`%`).
    - **Graphique de Vélocité des Versions (Inter-Releases)** :
      - Endpoint dédié `GET /api/versions/reports/velocity?projectKey=...`.
      - Histogramme Recharts multi-barres comparant par version :
        - 🟦 **Estimé** (Scope initial engagé en J)
        - 🟧 **Consommé Réel** (Total des worklogs Tempo en J)
        - 🟩 **Livré** (Effort des tickets finalisés et passés au statut Terminé / Fini)
    - **Analyse du Flux, Cycle Time & Temps par Statut (`GET /api/versions/:id/transitions`)** :
      - **Indicateurs Clés de Flux** :
        - *Cycle Time Moyen* : Durée moyenne de traversée d'un ticket entre le début du dev et la livraison.
        - *Goulot d'Étranglement Principal* : Détection automatique de l'étape active la plus consommatrice (ex: Recette, Dév).
        - *Temps Moyen en Statut Bloqué* : Mesure de l'impact des blocages (Blocked) sur la version.
      - **4 Visualisations Interactives au Choix (Toggle Dédié)** :
        - **1. Durée Moyenne par Statut (Entonnoir horizontal Recharts)** : Barres horizontales indiquant le temps moyen (en jours) passé dans chaque statut (*À faire*, *En cours*, *Validation Tech*, *Recette*, *Bloqué*, *Terminé*).
        - **2. Décomposition par Ticket (Barres Empilées Recharts)** : Vue détaillée ticket par ticket décomposant l'effort passé dans chaque statut avec palette de couleurs distincte.
        - **3. Cumulative Flow Diagram (CFD - Aires Empilées Recharts)** : Évolution hebdomadaire du volume de tickets par état, où la largeur d'une bande matérialise le délai de traitement de cette étape.
        - **4. Précision des Estimations (Scatter Plot Recharts)** : Nuage de points comparant l'estimation initiale (Axe X) au consommé réel Tempo (Axe Y) par rapport à la diagonale idéale $Y = X$. Mise en évidence des sous-estimations (dérives en rouge), estimations conformes (en vert) et sur-estimations (en bleu). **Clés Jira cliquables** dans les infobulles, au clic sur chaque point du graphique et dans le tableau des principaux outliers pour ouvrir directement le ticket dans Jira dans un nouvel onglet.
    - **Nouveaux Graphiques Analytiques de Pilotage de Version** :
      - **2. Staffing Collaborateurs & Typologie (Interne vs Externe)** : Barres horizontales nominatives de l'effort consommé (en jours) croisé avec le rôle et le statut contractuel (**Interne** 🔵 vs **Externe** 🟣). Mini-KPIs en en-tête synthétisant la ventilation globale et le volume de personnes mobilisées.
      - **3. Arrivée du Scope (Scope Creep & Volatilité)** : Diagramme combiné Recharts (`ComposedChart`) visualisant semaine par semaine le flux d'entrée de nouveaux tickets et de jours ajoutés face au rythme de finalisation (tickets livrés).
      - **4. Capacité Nette vs Charge Version (Faisabilité & Saturation)** : Comparaison entre la capacité théorique disponible de l'équipe sur la période de la release (jours ouvrés $\times$ contributeurs) face à la charge estimée (Scope) et au consommé réel, avec jauge de saturation / faisabilité (`%`).
      - **5. Respect des 6 Jalons Clés (Dérive Cible vs Réalisé)** : Histogramme des écarts en $\pm$ jours par rapport aux dates contractuelles des 6 étapes clés (*Fin À faire*, *Fin En cours*, *Fin MR*, *Fin Recette*, *MEPP*, *MEP*), complété par un tableau récapitulatif détaillé avec statuts diagnostiques (*Dans les temps*, *En avance*, *Retard*).

---

## 3. Ce qu'il ne faut PAS faire
- **Pas de champs financiers** (pas de TJM, pas de coûts).
- **Pas de persistance des simulations "What-If"** : les simulations de décalage dans la Timeline restent en mémoire côté front jusqu'à validation explicite.



