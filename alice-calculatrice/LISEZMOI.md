# Alice Calculatrice

Calculatrice scientifique de bureau (Windows, Electron) : calcul exact, equations, analyse, matrices,
graphiques 2D/3D, 91 lois de physique avec verification dimensionnelle, chimie (tableau periodique,
equilibrage, stoechiometrie, pH), statistiques, theorie des nombres.

Moteur : SymPy + mpmath dans Pyodide (aucune installation Python requise).

## Installation
Executer `AliceCalculatrice-installer/Installer_AliceCalculatrice.bat` (telecharge ~25 Mo : Pyodide depuis npm, SymPy/mpmath depuis PyPI).

## Verification
`verification/verify.py` compare le moteur a des references independantes (numpy, scipy, mpmath, valeurs IUPAC) :
841 reussites / 842, y compris en passant par l'application reelle (Pyodide).
Seul echec connu : aller-retour du loi de dilatation du temps quand v << c (perte de precision flottante).

## Limites
Pas de couverture a la Wolfram : certaines integrales/EDO/limites difficiles repondent « introuvable ».
Les equations transcendantes sans forme fermee donnent des racines numeriques reelles dans [-60, 60].
