# CartOMC - Capacity Planning

Application web moderne d'aide à la décision et de pilotage capacitif d'équipe (*Capacity Planning*), intégrant le suivi des ressources, la gestion fine des absences, l'évaluation macro/micro de projets (B0/B1), la ventilation mensuelle d'atterrissage capacitif, le suivi Jira/Tempo et la gouvernance par versions et jalons.

---

## 🎯 Fonctionnalités Clés

- **Référentiel Équipe & Ressources** :
  - Gestion des collaborateurs internes et prestataires externes avec taux d'activité (ETP), rôles et statuts.
  - Trombinoscope avec fiches profil glassmorphism et vue tabulaire dense.
  - Calcul dynamique de la capacité théorique en jours ouvrés français (Zone B, jours fériés légaux fixes et mobiles automatiques).
- **Gestion & Réconciliation des Absences** :
  - Import et réconciliation intelligente de fichiers CSV de congés (détection d'en-têtes et conventions de conversion).
  - Heatmap thermique d'absentéisme par ressource et détection automatique des pics simultanés d'absence.
  - Rapprochement automatique des intentions d'absence vs heures réelles déclarées sur les tickets d'absence Jira.
- **Portefeuille Projets & Ventilation Mensuelle** :
  - Double niveau d'estimation : Macro-chiffrage **B0** et chiffrage affiné **B1** avec seuils de tolérance et alertes de dérive capacitaire.
  - Matrice globale de ventilation annuelle (style Excel/Airtable) avec mode d'édition rapide en cellule, navigation clavier fluide et sauvegarde par lot (batch).
  - Vue Kanban Agile pour l'arbitrage en comité (statuts, priorités P0 à P4, typologies de charge).
- **Suivi des Versions & Gouvernance des Jalons Opérationnels** :
  - Pilotage des 6 jalons opérationnels de release (Fin À faire, Fin En cours, Fin MR, Fin Recette, MEPP, MEP).
  - Diagnostic d'anomalies en temps réel : alertes automatiques si un jalon est dépassé et que les statuts Jira des tickets ne sont pas conformes (non démarrés, retard de dév, MR ouverte, recette en cours, MEPP).
  - Stepper visuel interactif, modale d'inspection des tickets avec filtres dédiés et intégration directe au calendrier des jalons du Dashboard.
- **Tour de Contrôle & Tableaux de Bord** :
  - Visualisation en temps réel de l'adéquation charge / capacité (ETP nets vs charges planifiées).
  - Équilibre RUN vs BUILD (estimé vs réel extrait de Jira/Tempo).
  - Jalons de versionnage, gel de portefeuille et snapshots d'audit historiques.
- **Administration & Portabilité des Données** :
  - Export complet en 1 clic de toutes les collections MongoDB sous forme de snapshot JSON.
  - Restauration et réinjection facilitée pour testeurs locaux avec prévisualisation et modes au choix (*Remplacer* ou *Fusionner*).

---

## 🛠️ Architecture & Stack Technique

- **Frontend** :
  - [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) (bundlé avec [Vite](https://vitejs.dev/)).
  - [Recharts](https://recharts.org/) pour la restitution graphique et dataviz.
  - [Lucide React](https://lucide.dev/) pour l'iconographie.
  - Thème Dark Slate & Electric Cyan en CSS pur (Variables CSS et Glassmorphism translucide).
- **Backend** :
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (TypeScript via `tsx`).
  - [Mongoose](https://mongoosejs.com/) / [MongoDB](https://www.mongodb.com/) pour la persistance locale et la modélisation des schémas.
- **Intégrations** :
  - API REST Jira / Tempo pour le rapatriement des worklogs et des clés de tickets.

---

## 🚀 Démarrage Rapide

### 1. Prérequis

- [Node.js](https://nodejs.org/) (version 18+ recommandée)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) lancé localement sur le port par défaut (`27017`)
- Git installé sur la machine

### 2. Configuration des Variables d'Environnement

Dans le dossier `backend/`, dupliquez le fichier d'exemple `.env.example` en `.env` :

```bash
# Exemple de configuration backend/.env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/capacity_planning_cartomc
JIRA_BASE_URL=https://votre-domaine-jira.com
JIRA_DEFAULT_PROJECT=PROJECT
JIRA_API_TOKEN=votre_personal_access_token_ici
```

> ⚠️ **Sécurité** : Le fichier `.env` est automatiquement exclu du suivi Git via le fichier `.gitignore` afin de ne jamais divulguer de tokens sensibles.

### 3. Installation des Dépendances

À la racine du projet, installez l'ensemble des modules (racine, backend et frontend) :

```bash
npm run install:all
```

*(Ou alternativement : `npm install`, puis `npm install --prefix backend` et `npm install --prefix frontend`).*

### 4. Lancement de l'Application

Lancez le backend (port 4000) et le frontend (port 5173) en une seule commande grâce à `concurrently` :

```bash
npm run dev
```

L'application est ensuite accessible sur :
- **Frontend** : [http://localhost:5173](http://localhost:5173)
- **API Backend** : [http://localhost:4000](http://localhost:4000)

---

## 📁 Structure du Projet

```text
cartomc-capacity/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Point d'entrée du serveur Express & connexion MongoDB
│   │   ├── models/               # Schémas et modèles Mongoose (Ressources, Projets, Absences...)
│   │   ├── routes/               # Endpoints REST (absences, capacite, projets, dashboard, versions...)
│   │   ├── services/             # Logique d'intégration externe (ex: Jira, Tempo)
│   │   └── utils/                # Utilitaires de calculs (jours fériés, formules capacitaires)
│   ├── .env.example              # Gabarit de configuration d'environnement
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/           # Composants réutilisables (modaux, grilles, widgets KPI)
│   │   ├── pages/                # Écrans principaux (Projets, Absences, Ressources, Dashboard...)
│   │   ├── context/              # Contextes React (Gestion des rôles, toasters, état global)
│   │   ├── types/                # Déclarations des interfaces TypeScript
│   │   ├── index.css             # Design System & Thème sombre global
│   │   └── App.tsx               # Routeur et conteneur principal
│   ├── package.json
│   └── vite.config.ts
├── .gitignore                    # Exclusion des dossiers node_modules, dist et fichiers .env
├── PROJECT_GUIDE.md              # Spécifications métier et architecture de référence
└── README.md                     # Documentation d'accueil du projet
```

---

## 📖 Référence Métier & Spécifications

Pour toute précision sur les règles de calcul (heures vs jours, tolérances B0/B1, détection des pics de congés ou conventions CSV), référez-vous au document normatif :
👉 **[PROJECT_GUIDE.md](PROJECT_GUIDE.md)**
