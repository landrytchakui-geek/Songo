/**
 * =============================================================
 * SONGO — Version Ekang 
 * TCHAKUI KENGNE NOE LANDRY 24F2520
 * =============================================================
 */

"use strict";

/* ─────────────────────────────────────────────────────────────
   1. CONSTANTES DU JEU
───────────────────────────────────────────────────────────── */

const NB_CASES = 7;
const GRAINES_DEPART = 5;
const TOTAL_GRAINES = NB_CASES * 2 * GRAINES_DEPART; // 70
const SCORE_VICTOIRE = 40;
const SEUIL_FIN_PLATEAU = 10;
const SEUIL_GRAND_SEMIS = 13;

const JOUEUR = {
  SUD  : 'sud',
  NORD : 'nord'
};

const DELAI_ANIMATION = 180;

/* ─────────────────────────────────────────────────────────────
   2. ÉTAT DU JEU
───────────────────────────────────────────────────────────── */

let etat = creerEtatInitial();

function creerEtatInitial() {
  return {
    plateau: [
      Array(NB_CASES).fill(GRAINES_DEPART), // Rangée 0 (Nord)
      Array(NB_CASES).fill(GRAINES_DEPART)  // Rangée 1 (Sud)
    ],
    scores         : { [JOUEUR.SUD]: 0, [JOUEUR.NORD]: 0 },
    tourActuel     : JOUEUR.SUD,
    partieTerminee : false,
    animationEnCours: false
  };
}

/* ─────────────────────────────────────────────────────────────
   3. INITIALISATION & TOPOLOGIE (LA BOUCLE UNIQUE)
───────────────────────────────────────────────────────────────
   Pour former un cercle parfait sur l'écran (sens anti-horaire) :
   - SUD sème de droite à gauche : index 6 -> 0
   - NORD sème de gauche à droite sur l'écran (sa droite à sa gauche) : index 0 -> 6
───────────────────────────────────────────────────────────── */

const BOUCLE_UNIQUE = [
  { rangee: 1, index: 6 }, { rangee: 1, index: 5 }, { rangee: 1, index: 4 },
  { rangee: 1, index: 3 }, { rangee: 1, index: 2 }, { rangee: 1, index: 1 }, { rangee: 1, index: 0 },
  { rangee: 0, index: 0 }, { rangee: 0, index: 1 }, { rangee: 0, index: 2 },
  { rangee: 0, index: 3 }, { rangee: 0, index: 4 }, { rangee: 0, index: 5 }, { rangee: 0, index: 6 }
];

function rangeeDeJoueur(joueur) {
  return joueur === JOUEUR.SUD ? 1 : 0;
}

function joueurAdverse(joueur) {
  return joueur === JOUEUR.SUD ? JOUEUR.NORD : JOUEUR.SUD;
}

/* ─────────────────────────────────────────────────────────────
   4a. CALCUL DU PARCOURS DE SEMIS
───────────────────────────────────────────────────────────── */

function genererOrdreCompletSemis(joueur, indexDepart) {
  const rangeeJoueur = rangeeDeJoueur(joueur);
  const idxUnifie = BOUCLE_UNIQUE.findIndex(c => c.rangee === rangeeJoueur && c.index === indexDepart);
  
  const ordre = [];
  // On génère assez d'étapes pour vider la case la plus remplie (70 max)
  for (let i = 1; i <= TOTAL_GRAINES; i++) {
    ordre.push(BOUCLE_UNIQUE[(idxUnifie + i) % BOUCLE_UNIQUE.length]);
  }
  return ordre;
}

/* ─────────────────────────────────────────────────────────────
   4b. RÈGLE DES >13 GRAINES (GRAND SEMIS)
───────────────────────────────────────────────────────────── */

function genererOrdreGrandSemis(joueur, indexDepart) {
  const rangeeJoueur  = rangeeDeJoueur(joueur);
  const rangeeAdverse = 1 - rangeeJoueur;
  const idxUnifie = BOUCLE_UNIQUE.findIndex(c => c.rangee === rangeeJoueur && c.index === indexDepart);
  const ordre = [];

  // Phase 1 : tour complet (13 cases, on saute le départ)
  for (let i = 1; i < BOUCLE_UNIQUE.length; i++) {
    ordre.push(BOUCLE_UNIQUE[(idxUnifie + i) % BOUCLE_UNIQUE.length]);
  }

  // Phase 2 : distribution exclusive chez l'adversaire
  // Le filtre préserve naturellement le sens de rotation de la BOUCLE_UNIQUE
  const casesAdverses = BOUCLE_UNIQUE.filter(c => c.rangee === rangeeAdverse);
  
  for (let cycle = 0; cycle < 10; cycle++) {
    ordre.push(...casesAdverses);
  }

  return ordre;
}

/* ─────────────────────────────────────────────────────────────
   4c. SIMULATION D'UN COUP
───────────────────────────────────────────────────────────── */

function simulerCoup(plateauCourant, joueur, indexCase) {
  const plateau = plateauCourant.map(rangee => [...rangee]);
  const rangeeJoueur = rangeeDeJoueur(joueur);
  const rangeeAdverse = 1 - rangeeJoueur;

  let grainesEnMain = plateau[rangeeJoueur][indexCase];
  plateau[rangeeJoueur][indexCase] = 0;

  const ordre = grainesEnMain > SEUIL_GRAND_SEMIS
    ? genererOrdreGrandSemis(joueur, indexCase)
    : genererOrdreCompletSemis(joueur, indexCase);

  const parcours = [];
  let positionDansOrdre = 0;

  while (grainesEnMain > 0 && positionDansOrdre < ordre.length) {
    const { rangee, index } = ordre[positionDansOrdre];
    plateau[rangee][index]++;
    grainesEnMain--;
    parcours.push({ rangee, index });
    positionDansOrdre++;
  }

  const derniereCase = parcours.length > 0 ? parcours[parcours.length - 1] : null;
  let grainesChezAdverse = parcours.filter(p => p.rangee === rangeeAdverse).length;

  return { plateau, derniereCase, grainesChezAdverse, parcours };
}

/* ─────────────────────────────────────────────────────────────
   4d. VALIDATION D'UN COUP (SOLIDARITÉ ET INTERDITS)
───────────────────────────────────────────────────────────── */

function campAdverseVide(plateau, joueur) {
  const rangeeAdverse = 1 - rangeeDeJoueur(joueur);
  return plateau[rangeeAdverse].every(g => g === 0);
}

function totalGrainesPlateau(plateau) {
  return plateau[0].reduce((s, g) => s + g, 0) + plateau[1].reduce((s, g) => s + g, 0);
}

function calculerCoupsDisponibles(plateau, joueur) {
  const rangeeJoueur = rangeeDeJoueur(joueur);
  const adverseVide  = campAdverseVide(plateau, joueur);
  
  // Dans la géométrie corrigée, la case n°7 est à l'index 6 pour Sud, mais à l'index 0 pour Nord
  const indexCase7 = (joueur === JOUEUR.SUD) ? 6 : 0;

  const casesNonVides = [];
  for (let i = 0; i < NB_CASES; i++) {
    if (plateau[rangeeJoueur][i] > 0) casesNonVides.push(i);
  }

  if (casesNonVides.length === 0) {
    return { coupsValides: [], solidariteActivee: false, finDePartie: true };
  }

  if (!adverseVide) {
    const coupsValides = [];
    for (const index of casesNonVides) {
      const sim = simulerCoup(plateau, joueur, index);

      // Interdit A : case n°7 qui sème 1 ou 2 graines chez l'adversaire
      if (index === indexCase7 && sim.grainesChezAdverse > 0 && sim.grainesChezAdverse <= 2) {
        continue;
      }
      coupsValides.push(index);
    }

    if (coupsValides.length === 0) {
      return { coupsValides: casesNonVides, solidariteActivee: false, finDePartie: false };
    }
    return { coupsValides, solidariteActivee: false, finDePartie: false };

  } else {
    // Solidarité
    let maxGrainesEnvoyees = 0;
    const resultatsParCase = [];

    for (const index of casesNonVides) {
      const sim = simulerCoup(plateau, joueur, index);
      resultatsParCase.push({ index, grainesChezAdverse: sim.grainesChezAdverse });
      if (sim.grainesChezAdverse > maxGrainesEnvoyees) {
        maxGrainesEnvoyees = sim.grainesChezAdverse;
      }
    }

    if (maxGrainesEnvoyees === 0) {
      return { coupsValides: [], solidariteActivee: true, finDePartie: true };
    }

    const seuilSolidarite = maxGrainesEnvoyees >= NB_CASES ? NB_CASES : maxGrainesEnvoyees;
    const coupsValides = resultatsParCase
      .filter(r => r.grainesChezAdverse === seuilSolidarite)
      .map(r => r.index);

    return { coupsValides, solidariteActivee: true, finDePartie: false };
  }
}

/* ─────────────────────────────────────────────────────────────
   4e. EXÉCUTION D'UN COUP
───────────────────────────────────────────────────────────── */

function executerCoup(joueur, indexCase) {
  const rangeeJoueur  = rangeeDeJoueur(joueur);
  const rangeeAdverse = 1 - rangeeJoueur;

  let grainesEnMain = etat.plateau[rangeeJoueur][indexCase];
  etat.plateau[rangeeJoueur][indexCase] = 0;

  const estGrandSemis = grainesEnMain > SEUIL_GRAND_SEMIS;
  const ordre = estGrandSemis
    ? genererOrdreGrandSemis(joueur, indexCase)
    : genererOrdreCompletSemis(joueur, indexCase);

  const parcours = [];
  let positionDansOrdre = 0;

  while (grainesEnMain > 0 && positionDansOrdre < ordre.length) {
    const { rangee, index } = ordre[positionDansOrdre];
    etat.plateau[rangee][index]++;
    grainesEnMain--;
    parcours.push({ rangee, index });
    positionDansOrdre++;
  }

  if (parcours.length === 0) return { parcours: [], prises: [], vidageCampInterdit: false };

  const derniereCase = parcours[parcours.length - 1];
  const campAdverseApres = etat.plateau[rangeeAdverse].reduce((s, g) => s + g, 0);
  
  if (campAdverseApres === 0) {
    return { parcours, prises: [], vidageCampInterdit: true };
  }

  const prises = calculerPrises(joueur, derniereCase, estGrandSemis);

  let totalPris = 0;
  for (const prise of prises) {
    totalPris += etat.plateau[prise.rangee][prise.index];
    etat.plateau[prise.rangee][prise.index] = 0;
  }
  etat.scores[joueur] += totalPris;

  return { parcours, prises, vidageCampInterdit: false };
}

/* ─────────────────────────────────────────────────────────────
   4f. CALCUL DES PRISES (Adapté à la boucle unique)
───────────────────────────────────────────────────────────── */

function calculerPrises(joueur, derniereCase, estGrandSemis) {
  const rangeeAdverse = 1 - rangeeDeJoueur(joueur);
  if (derniereCase.rangee !== rangeeAdverse) return [];

  const prises = [];
  let indexCourant = derniereCase.index;

  // Définition de la marche arrière dans la géométrie de la boucle
  // NORD (0) sème de 0 vers 6 -> marche arrière = -1 (Case protégée = 0)
  // SUD (1) sème de 6 vers 0 -> marche arrière = +1 (Case protégée = 6)
  const pas = rangeeAdverse === 0 ? -1 : 1;
  const indexCaseProtegee = rangeeAdverse === 0 ? 0 : 6;

  while (true) {
    if (indexCourant < 0 || indexCourant >= NB_CASES) break;

    const nbGraines = etat.plateau[rangeeAdverse][indexCourant];
    const casePrisable = nbGraines >= 2 && nbGraines <= 4;

    if (!casePrisable) break;

    if (indexCourant === indexCaseProtegee) {
      if (prises.length === 0) {
        // Prise directe sur case protégée interdite sauf si >14 graines (1 graine)
        if (estGrandSemis && nbGraines === 1) {
          prises.push({ rangee: rangeeAdverse, index: indexCourant });
        }
        break;
      } else {
        // Prise à la chaîne valide sur la case protégée
        prises.push({ rangee: rangeeAdverse, index: indexCourant });
        break;
      }
    }

    prises.push({ rangee: rangeeAdverse, index: indexCourant });
    indexCourant += pas;
  }

  return prises;
}

/* ─────────────────────────────────────────────────────────────
   5. GESTION DU TOUR
───────────────────────────────────────────────────────────── */

function verifierFinDePartie() {
  for (const joueur of [JOUEUR.SUD, JOUEUR.NORD]) {
    if (etat.scores[joueur] >= SCORE_VICTOIRE) {
      const nomJoueur = joueur === JOUEUR.SUD ? 'Sud' : 'Nord';
      return `${nomJoueur} a atteint ${etat.scores[joueur]} graines et remporte la partie !`;
    }
  }

  if (totalGrainesPlateau(etat.plateau) < SEUIL_FIN_PLATEAU) {
    for (const joueur of [JOUEUR.SUD, JOUEUR.NORD]) {
      const rangee = rangeeDeJoueur(joueur);
      const grainesRestantes = etat.plateau[rangee].reduce((s, g) => s + g, 0);
      etat.scores[joueur] += grainesRestantes;
      etat.plateau[rangee].fill(0);
    }
    const vainqueur = etat.scores[JOUEUR.SUD] >= etat.scores[JOUEUR.NORD]
      ? (etat.scores[JOUEUR.SUD] > etat.scores[JOUEUR.NORD] ? 'Sud' : null)
      : 'Nord';
    if (vainqueur) return `Moins de ${SEUIL_FIN_PLATEAU} graines sur le plateau. ${vainqueur} remporte la partie !`;
    return `Moins de ${SEUIL_FIN_PLATEAU} graines sur le plateau. Égalité !`;
  }
  return null;
}

function passerAuTourSuivant() {
  etat.tourActuel = joueurAdverse(etat.tourActuel);
  const { coupsValides, solidariteActivee, finDePartie } = calculerCoupsDisponibles(etat.plateau, etat.tourActuel);

  if (finDePartie) {
    for (const joueur of [JOUEUR.SUD, JOUEUR.NORD]) {
      const rangee = rangeeDeJoueur(joueur);
      const grainesRestantes = etat.plateau[rangee].reduce((s, g) => s + g, 0);
      etat.scores[joueur] += grainesRestantes;
      etat.plateau[rangee].fill(0);
    }
    const vainqueur = etat.scores[JOUEUR.SUD] > etat.scores[JOUEUR.NORD] ? 'Sud'
      : etat.scores[JOUEUR.NORD] > etat.scores[JOUEUR.SUD] ? 'Nord'
      : null;
    const message = vainqueur ? `Solidarité impossible. ${vainqueur} remporte la partie !` : 'Solidarité impossible. Égalité !';
    terminerPartie(message);
    return;
  }

  const msgFinPartie = verifierFinDePartie();
  if (msgFinPartie) {
    terminerPartie(msgFinPartie);
    return;
  }

  const nomJoueur = etat.tourActuel === JOUEUR.SUD ? 'Sud' : 'Nord';
  definirMessageTour(`C'est au tour de ${nomJoueur}`);
  if (solidariteActivee) definirMessageInfo('⚠ Solidarité : vous devez distribuer des graines chez l\'adversaire.');
  else definirMessageInfo('');

  afficherPlateau(coupsValides);
}

function terminerPartie(message) {
  etat.partieTerminee = true;
  afficherPlateau([]);
  mettreAJourScores();
  afficherModaleFinPartie(message);
}

/* ─────────────────────────────────────────────────────────────
   6. RENDU (DOM)
───────────────────────────────────────────────────────────── */

function construirePlateau() {
  const rangeeNordEl = document.getElementById('rangee-nord');
  const rangeeSudEl  = document.getElementById('rangee-sud');
  rangeeNordEl.innerHTML = '';
  rangeeSudEl.innerHTML  = '';

  for (let i = 0; i < NB_CASES; i++) {
    rangeeNordEl.appendChild(creerElementCase(0, i));
    rangeeSudEl.appendChild(creerElementCase(1, i));
  }
}

function creerElementCase(rangee, index) {
  const caseEl = document.createElement('div');
  caseEl.className = 'case';
  caseEl.dataset.rangee = rangee;
  caseEl.dataset.index  = index;
  caseEl.id = `case-${rangee}-${index}`;

  const compteur = document.createElement('span');
  compteur.className = 'case-compteur';
  compteur.textContent = GRAINES_DEPART;

  const grainesVisuelles = document.createElement('div');
  grainesVisuelles.className = 'case-graines-visuelles';

  caseEl.appendChild(compteur);
  caseEl.appendChild(grainesVisuelles);
  caseEl.addEventListener('click', () => gererClicCase(rangee, index));

  return caseEl;
}

function afficherPlateau(coupsValides) {
  const rangeeJoueur = rangeeDeJoueur(etat.tourActuel);

  for (let rangee = 0; rangee < 2; rangee++) {
    for (let index = 0; index < NB_CASES; index++) {
      const caseEl = document.getElementById(`case-${rangee}-${index}`);
      if (!caseEl) continue;

      const nbGraines = etat.plateau[rangee][index];
      caseEl.querySelector('.case-compteur').textContent = nbGraines;
      mettreAJourGrainesVisuelles(caseEl, nbGraines);

      caseEl.className = 'case';
      if (nbGraines === 0) caseEl.classList.add('vide');

      const appartientAuJoueurActif = rangee === rangeeJoueur;
      const estJouable = !etat.partieTerminee && !etat.animationEnCours && appartientAuJoueurActif && coupsValides.includes(index) && nbGraines > 0;

      if (estJouable) {
        caseEl.classList.add('jouable');
      } else if (appartientAuJoueurActif && nbGraines > 0 && !etat.partieTerminee) {
        caseEl.classList.add('invalide');
      }
    }
  }

  document.getElementById('info-nord').classList.toggle('actif', etat.tourActuel === JOUEUR.NORD);
  document.getElementById('info-sud').classList.toggle('actif', etat.tourActuel === JOUEUR.SUD);
  mettreAJourScores();
}

function mettreAJourGrainesVisuelles(caseEl, nbGraines) {
  const conteneur = caseEl.querySelector('.case-graines-visuelles');
  conteneur.innerHTML = '';
  const nbRonds = Math.min(nbGraines, 6);
  for (let i = 0; i < nbRonds; i++) {
    const rond = document.createElement('div');
    rond.className = 'graine-visuelle';
    conteneur.appendChild(rond);
  }
}

function mettreAJourScores() {
  document.getElementById('score-nord').textContent = etat.scores[JOUEUR.NORD];
  document.getElementById('score-sud').textContent  = etat.scores[JOUEUR.SUD];
}

function definirMessageTour(message) {
  document.getElementById('message-tour').textContent = message;
}

function definirMessageInfo(message) {
  document.getElementById('message-info').textContent = message;
}

/* ─────────────────────────────────────────────────────────────
   7. ANIMATIONS
───────────────────────────────────────────────────────────── */

function animerSemis(parcours, prises, callback) {
  etat.animationEnCours = true;
  afficherPlateau([]); // Désactive les clics
  let etapeActuelle = 0;

  const intervalId = setInterval(() => {
    if (etapeActuelle > 0) {
      const precCase = parcours[etapeActuelle - 1];
      const precEl = document.getElementById(`case-${precCase.rangee}-${precCase.index}`);
      if (precEl) precEl.classList.remove('semee');
    }

    if (etapeActuelle < parcours.length) {
      const { rangee, index } = parcours[etapeActuelle];
      const caseEl = document.getElementById(`case-${rangee}-${index}`);
      if (caseEl) {
        caseEl.classList.add('semee');
        void caseEl.offsetWidth; // Reflow
      }
      etapeActuelle++;
    } else {
      clearInterval(intervalId);
      for (const prise of prises) {
        const priseEl = document.getElementById(`case-${prise.rangee}-${prise.index}`);
        if (priseEl) {
          priseEl.classList.add('selectionnee');
          setTimeout(() => priseEl.classList.remove('selectionnee'), 400);
        }
      }
      setTimeout(() => {
        etat.animationEnCours = false;
        callback();
      }, prises.length > 0 ? 450 : 100);
    }
  }, DELAI_ANIMATION);
}

/* ─────────────────────────────────────────────────────────────
   8. ÉVÉNEMENTS (CLICS & MODALES)
───────────────────────────────────────────────────────────── */

function gererClicCase(rangee, index) {
  if (etat.animationEnCours || etat.partieTerminee) return;
  if (rangee !== rangeeDeJoueur(etat.tourActuel) || etat.plateau[rangee][index] === 0) return;

  const { coupsValides } = calculerCoupsDisponibles(etat.plateau, etat.tourActuel);
  if (!coupsValides.includes(index)) return;

  document.getElementById(`case-${rangee}-${index}`)?.classList.add('selectionnee');
  definirMessageInfo('Semis en cours…');

  const { parcours, prises, vidageCampInterdit } = executerCoup(etat.tourActuel, index);
  if (vidageCampInterdit) definirMessageInfo('⚠ Ce coup viderait le camp adverse : aucune prise.');

  animerSemis(parcours, prises, () => {
    const msgFin = verifierFinDePartie();
    if (msgFin) terminerPartie(msgFin);
    else {
      if (prises.length > 0) definirMessageInfo(`${prises.length} case(s) capturée(s) !`);
      else if (!vidageCampInterdit) definirMessageInfo('');
      passerAuTourSuivant();
    }
  });
}

function afficherModaleFinPartie(message) {
  document.getElementById('modale-message').textContent = message;
  document.getElementById('modale-score-nord').textContent = etat.scores[JOUEUR.NORD];
  document.getElementById('modale-score-sud').textContent  = etat.scores[JOUEUR.SUD];
  const fond = document.getElementById('modale-fond');
  fond.classList.add('visible');
  fond.setAttribute('aria-hidden', 'false');
}

function fermerModaleFinPartie() {
  const fond = document.getElementById('modale-fond');
  fond.classList.remove('visible');
  fond.setAttribute('aria-hidden', 'true');
}

function nouvellePartie() {
  fermerModaleFinPartie();
  etat = creerEtatInitial();
  definirMessageTour('C\'est au tour de Sud');
  definirMessageInfo('');
  const { coupsValides } = calculerCoupsDisponibles(etat.plateau, etat.tourActuel);
  afficherPlateau(coupsValides);
}

/* ─────────────────────────────────────────────────────────────
   9. DÉMARRAGE
───────────────────────────────────────────────────────────── */

function initialiser() {
  construirePlateau();
  const { coupsValides } = calculerCoupsDisponibles(etat.plateau, etat.tourActuel);
  afficherPlateau(coupsValides);
  definirMessageTour('C\'est au tour de Sud');
  definirMessageInfo('');

  document.getElementById('btn-nouvelle-partie').addEventListener('click', nouvellePartie);
  document.getElementById('btn-rejouer').addEventListener('click', nouvellePartie);
  document.getElementById('btn-regles').addEventListener('click', () => {
    const fond = document.getElementById('modale-regles-fond');
    fond.classList.add('visible');
    fond.setAttribute('aria-hidden', 'false');
  });
  document.getElementById('btn-fermer-regles').addEventListener('click', () => {
    const fond = document.getElementById('modale-regles-fond');
    fond.classList.remove('visible');
    fond.setAttribute('aria-hidden', 'true');
  });
  document.getElementById('modale-regles-fond').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modale-regles-fond')) {
      document.getElementById('modale-regles-fond').classList.remove('visible');
    }
  });
}

document.addEventListener('DOMContentLoaded', initialiser);
