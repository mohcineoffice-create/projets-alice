import datetime as dt, random
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule, DataBarRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter as L

F = "Arial"
NAVY = "1F4E79"; LIGHT = "E3ECF5"; YEL = "FFF2CC"; GREY = "F2F2F2"
thin = Side(style="thin", color="C9D6E3"); B = Border(left=thin, right=thin, top=thin, bottom=thin)
def font(**k): return Font(name=F, **k)
def hdr(c):
    c.font = font(bold=True, color="FFFFFF", size=10); c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True); c.border = B
def inp(c):
    c.fill = PatternFill("solid", fgColor=YEL); c.font = font(color="0000FF", size=10); c.border = B
def calc(c, fmt=None):
    c.font = font(size=10); c.border = B; c.fill = PatternFill("solid", fgColor=GREY)
    if fmt: c.number_format = fmt
def title(ws, t, sub):
    ws["A1"] = t; ws["A1"].font = font(bold=True, size=16, color=NAVY)
    ws["A2"] = sub; ws["A2"].font = font(italic=True, size=10, color="5A6570")

wb = Workbook()

# ---------------- Mode d'emploi ----------------
me = wb.active; me.title = "Mode d'emploi"
title(me, "Tableau de bord TRS / OEE", "Suivi de la performance des machines : Disponibilité × Performance × Qualité")
lines = [
 ("Comment l'utiliser", None),
 ("1. Onglet « Paramètres » : saisissez vos machines, leur cadence théorique (pièces/heure) et votre objectif de TRS.", None),
 ("2. Onglet « Saisie » : une ligne par machine et par poste (date, équipe, temps d'ouverture, arrêts, pièces).", None),
 ("3. Onglet « Tableau de bord » : choisissez la période (date de début et de fin). Tout se calcule automatiquement.", None),
 ("4. Onglet « Évolution » : TRS jour par jour sur 31 jours à partir de la date de début choisie.", None),
 ("", None),
 ("Légende des cellules", None),
 ("Cellule jaune, texte bleu", "À remplir par vous"),
 ("Cellule grise", "Calcul automatique : ne pas modifier"),
 ("", None),
 ("Formules utilisées (norme NF E60-182)", None),
 ("Temps de fonctionnement", "Temps d'ouverture − Arrêts"),
 ("Disponibilité", "Temps de fonctionnement ÷ Temps d'ouverture"),
 ("Performance", "(Pièces produites × Temps de cycle) ÷ Temps de fonctionnement"),
 ("Qualité", "Pièces bonnes ÷ Pièces produites"),
 ("TRS", "Disponibilité × Performance × Qualité  =  Temps utile ÷ Temps d'ouverture"),
 ("", None),
 ("Données d'exemple", None),
 ("Les onglets contiennent des données fictives pour vous montrer le résultat. Remplacez les machines dans « Paramètres »", None),
 ("et effacez les lignes d'exemple de « Saisie » (colonnes jaunes uniquement) avant de saisir vos propres données.", None),
]
r = 4
for a, b in lines:
    me.cell(r, 1, a); me.cell(r, 1).font = font(size=10)
    if b is None and a and not a[0].isdigit() and not a.startswith(("Les ", "et ")):
        me.cell(r, 1).font = font(bold=True, size=12, color=NAVY)
    if b:
        me.cell(r, 2, b).font = font(size=10)
        if a.startswith("Cellule jaune"): inp(me.cell(r, 1))
        elif a.startswith("Cellule grise"): calc(me.cell(r, 1))
        else: me.cell(r, 1).font = font(bold=True, size=10)
    r += 1
me.column_dimensions["A"].width = 34; me.column_dimensions["B"].width = 80

# ---------------- Paramètres ----------------
pa = wb.create_sheet("Paramètres")
title(pa, "Paramètres", "Machines, cadences théoriques et objectif")
pa["A4"] = "Objectif de TRS"; pa["A4"].font = font(bold=True, size=10)
pa["B4"] = 0.85; inp(pa["B4"]); pa["B4"].number_format = "0%"
pa["C4"] = "Référence courante : 85 % = niveau « classe mondiale ». Ajustez selon votre atelier."
pa["C4"].font = font(italic=True, size=9, color="5A6570")
for j, h in enumerate(["Machine", "Atelier", "Cadence théorique (pièces/h)", "Temps de cycle (min/pièce)"], 1):
    hdr(pa.cell(6, j, h))
machines = [("Presse P01", "Emboutissage", 600), ("Presse P02", "Emboutissage", 540),
            ("Tour CN T03", "Usinage", 45), ("Robot soudure R04", "Soudure", 120),
            ("Ligne assemblage A05", "Assemblage", 240)]
NM = 15
for i in range(NM):
    rr = 7 + i
    for j in (1, 2, 3): inp(pa.cell(rr, j))
    if i < len(machines):
        m, a, c = machines[i]; pa.cell(rr, 1, m); pa.cell(rr, 2, a); pa.cell(rr, 3, c)
    pa.cell(rr, 4, f'=IF(C{rr}>0,60/C{rr},"")'); calc(pa.cell(rr, 4), "0.000")
for col, w in zip("ABCD", (26, 18, 22, 22)): pa.column_dimensions[col].width = w
pa.cell(7 + NM + 1, 1, "Jusqu'à 15 machines. Les noms doivent être uniques.").font = font(italic=True, size=9, color="5A6570")
MACH = f"Paramètres!$A$7:$A${6+NM}"; CAD = f"Paramètres!$C$7:$C${6+NM}"

# ---------------- Saisie ----------------
sa = wb.create_sheet("Saisie")
title(sa, "Saisie des postes", "Une ligne = une machine sur un poste. Remplissez uniquement les colonnes jaunes.")
heads = ["Date", "Équipe", "Machine", "Temps d'ouverture (min)", "Pannes (min)", "Réglages / changements de série (min)",
         "Micro-arrêts (min)", "Autres arrêts (min)", "Pièces produites", "Pièces rebutées",
         "Arrêts totaux (min)", "Temps de fonctionnement (min)", "Pièces bonnes", "Disponibilité", "Performance", "Qualité", "TRS", "Temps utile (min)"]
for j, h in enumerate(heads, 1): hdr(sa.cell(4, j, h))
sa.row_dimensions[4].height = 45
NR = 500; R0 = 5; R1 = R0 + NR - 1
dv_m = DataValidation(type="list", formula1=f"={MACH}", allow_blank=True)
dv_e = DataValidation(type="list", formula1='"Matin,Après-midi,Nuit"', allow_blank=True)
sa.add_data_validation(dv_m); sa.add_data_validation(dv_e)
dv_m.add(f"C{R0}:C{R1}"); dv_e.add(f"B{R0}:B{R1}")

random.seed(7)
start = dt.date(2026, 10, 1)
ex = []
prof = {"Presse P01": (0.90, 0.92, 0.985), "Presse P02": (0.82, 0.88, 0.97), "Tour CN T03": (0.86, 0.80, 0.99),
        "Robot soudure R04": (0.93, 0.95, 0.995), "Ligne assemblage A05": (0.78, 0.85, 0.96)}
for d in range(14):
    for (m, a, cad) in machines:
        for eq in ("Matin", "Après-midi"):
            ouv = 450
            av, pv, qv = prof[m]
            dispo = min(0.99, max(0.6, random.gauss(av, 0.04)))
            stops = round(ouv * (1 - dispo))
            pannes = round(stops * random.uniform(0.3, 0.6)); reg = round(stops * random.uniform(0.15, 0.35))
            micro = round(stops * random.uniform(0.05, 0.15)); autres = max(0, stops - pannes - reg - micro)
            fonct = ouv - (pannes + reg + micro + autres)
            perf = min(0.99, max(0.6, random.gauss(pv, 0.03)))
            prod = int(fonct * perf * cad / 60)
            rej = int(round(prod * (1 - min(0.999, max(0.9, random.gauss(qv, 0.01))))))
            ex.append([start + dt.timedelta(days=d), eq, m, ouv, pannes, reg, micro, autres, prod, rej])

for i in range(NR):
    rr = R0 + i
    for j in range(1, 11): inp(sa.cell(rr, j))
    sa.cell(rr, 1).number_format = "dd/mm/yyyy"
    if i < len(ex):
        for j, v in enumerate(ex[i], 1): sa.cell(rr, j, v)
    f = {11: f'=IF(D{rr}="","",SUM(E{rr}:H{rr}))',
         12: f'=IF(D{rr}="","",D{rr}-K{rr})',
         13: f'=IF(I{rr}="","",I{rr}-J{rr})',
         14: f'=IF(OR(D{rr}="",D{rr}=0),"",L{rr}/D{rr})',
         15: f'=IFERROR(IF(OR(L{rr}="",L{rr}=0,I{rr}=""),"",I{rr}*60/INDEX({CAD},MATCH(C{rr},{MACH},0))/L{rr}),"")',
         16: f'=IF(OR(I{rr}="",I{rr}=0),"",M{rr}/I{rr})',
         17: f'=IF(OR(N{rr}="",O{rr}="",P{rr}=""),"",N{rr}*O{rr}*P{rr})',
         18: f'=IFERROR(IF(M{rr}="","",M{rr}*60/INDEX({CAD},MATCH(C{rr},{MACH},0))),"")'}
    for j, fx in f.items():
        sa.cell(rr, j, fx); calc(sa.cell(rr, j), "0.0%" if 14 <= j <= 17 else "0")
widths = [12, 12, 22, 12, 10, 14, 10, 10, 11, 11, 11, 13, 10, 12, 12, 10, 10, 11]
for j, w in enumerate(widths, 1): sa.column_dimensions[L(j)].width = w
sa.freeze_panes = "D5"
sa.conditional_formatting.add(f"Q{R0}:Q{R1}", CellIsRule(operator="lessThan", formula=["Paramètres!$B$4*0.85"], font=Font(name=F, color="C00000", bold=True)))
sa.conditional_formatting.add(f"Q{R0}:Q{R1}", CellIsRule(operator="greaterThanOrEqual", formula=["Paramètres!$B$4"], font=Font(name=F, color="007A33", bold=True)))

def S(col, crit_m=None):
    rng = f"Saisie!${col}${R0}:${col}${R1}"
    dates = f"Saisie!$A${R0}:$A${R1}"
    base = f'{rng},{dates},">="&$C$4,{dates},"<="&$C$5'
    if crit_m: base += f",Saisie!$C${R0}:$C${R1},{crit_m}"
    return f"SUMIFS({base})"

# ---------------- Tableau de bord ----------------
tb = wb.create_sheet("Tableau de bord")
title(tb, "Tableau de bord TRS / OEE", "Choisissez la période : tous les indicateurs se recalculent.")
tb["B4"] = "Date de début"; tb["B5"] = "Date de fin"
for c in ("B4", "B5"): tb[c].font = font(bold=True, size=10)
tb["C4"] = dt.date(2026, 10, 1); tb["C5"] = dt.date(2026, 10, 14)
for c in ("C4", "C5"): inp(tb[c]); tb[c].number_format = "dd/mm/yyyy"

# KPI tiles row 7-8
kp = [("TRS global", "=IFERROR(SUM($L$13:$L$27)/SUM($C$13:$C$27),0)"),
      ("Disponibilité", "=IFERROR(SUM($E$13:$E$27)/SUM($C$13:$C$27),0)"),
      ("Performance", "=IFERROR(SUM($K$13:$K$27)/SUM($E$13:$E$27),0)"),
      ("Qualité", "=IFERROR(SUM($H$13:$H$27)/SUM($F$13:$F$27),0)"),
      ("Objectif", "=Paramètres!$B$4")]
for i, (lab, fx) in enumerate(kp):
    col = 2 + i * 2
    tb.merge_cells(start_row=7, start_column=col, end_row=7, end_column=col + 1)
    tb.merge_cells(start_row=8, start_column=col, end_row=9, end_column=col + 1)
    c = tb.cell(7, col, lab); c.font = font(bold=True, size=10, color="FFFFFF"); c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = Alignment(horizontal="center")
    v = tb.cell(8, col, fx); v.font = font(bold=True, size=22, color=NAVY); v.number_format = "0.0%"
    v.alignment = Alignment(horizontal="center", vertical="center"); v.fill = PatternFill("solid", fgColor=LIGHT)
tb.conditional_formatting.add("B8", CellIsRule(operator="lessThan", formula=["$J$8"], font=Font(name=F, bold=True, size=22, color="C00000")))
tb.conditional_formatting.add("B8", CellIsRule(operator="greaterThanOrEqual", formula=["$J$8"], font=Font(name=F, bold=True, size=22, color="007A33")))

th = ["Machine", "Temps d'ouverture (min)", "Arrêts (min)", "Temps de fonctionnement (min)", "Pièces produites", "Pièces bonnes",
      "Disponibilité", "Performance", "Qualité", "Temps net (min)", "Temps utile (min)", "TRS", "Écart / objectif"]
for j, h in enumerate(th, 2): hdr(tb.cell(12, j, h))
tb.row_dimensions[12].height = 42
for i in range(NM):
    rr = 13 + i; m = f"$B{rr}"
    tb.cell(rr, 2, f'=IF(Paramètres!A{7+i}="","",Paramètres!A{7+i})')
    fx = {3: f'=IF({m}="","",{S("D", m)})', 4: f'=IF({m}="","",{S("K", m)})', 5: f'=IF({m}="","",C{rr}-D{rr})',
          6: f'=IF({m}="","",{S("I", m)})', 7: f'=IF({m}="","",{S("M", m)})',
          8: f'=IF(OR({m}="",C{rr}=0),"",E{rr}/C{rr})',
          9: f'=IF(OR({m}="",E{rr}=0),"",K{rr}/E{rr})',
          10: f'=IF(OR({m}="",F{rr}=0),"",G{rr}/F{rr})',
          11: f'=IF({m}="","",IFERROR(F{rr}*60/INDEX({CAD},MATCH({m},{MACH},0)),0))',
          12: f'=IF({m}="","",IFERROR(G{rr}*60/INDEX({CAD},MATCH({m},{MACH},0)),0))',
          13: f'=IF(OR({m}="",C{rr}=0),"",L{rr}/C{rr})',
          14: f'=IF(M{rr}="","",M{rr}-Paramètres!$B$4)'}
    calc(tb.cell(rr, 2))
    for j, f_ in fx.items():
        tb.cell(rr, j, f_); calc(tb.cell(rr, j), "0.0%" if j in (8, 9, 10, 13, 14) else "#,##0")
# Note: H/I/J are dispo/perf/qual ; K temps net ; L temps utile ; M TRS
# fix KPI refs to those columns
tb["B8"] = "=IFERROR(SUM($L$13:$L$27)/SUM($C$13:$C$27),0)"
tb["D8"] = "=IFERROR(SUM($E$13:$E$27)/SUM($C$13:$C$27),0)"
tb["F8"] = "=IFERROR(SUM($K$13:$K$27)/SUM($E$13:$E$27),0)"
tb["H8"] = "=IFERROR(SUM($L$13:$L$27)/SUM($K$13:$K$27),0)"
tb.conditional_formatting.add("M13:M27", CellIsRule(operator="lessThan", formula=["Paramètres!$B$4*0.85"], font=Font(name=F, color="C00000", bold=True)))
tb.conditional_formatting.add("M13:M27", CellIsRule(operator="greaterThanOrEqual", formula=["Paramètres!$B$4"], font=Font(name=F, color="007A33", bold=True)))
tb.conditional_formatting.add("N13:N27", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, color="C00000")))

# Pertes (minutes) for the period
tb["B30"] = "Répartition des pertes sur la période (minutes)"; tb["B30"].font = font(bold=True, size=12, color=NAVY)
hdr(tb.cell(31, 2, "Cause de perte")); hdr(tb.cell(31, 3, "Minutes")); hdr(tb.cell(31, 4, "Part"))
pertes = [("Pannes", S("E")), ("Réglages / changements de série", S("F")), ("Micro-arrêts", S("G")),
          ("Autres arrêts", S("H")), ("Écarts de cadence", "SUM($E$13:$E$27)-SUM($K$13:$K$27)"),
          ("Non-qualité (rebuts)", "SUM($K$13:$K$27)-SUM($L$13:$L$27)")]
for i, (lab, fx) in enumerate(pertes):
    rr = 32 + i
    tb.cell(rr, 2, lab); calc(tb.cell(rr, 2))
    tb.cell(rr, 3, f"={fx}"); calc(tb.cell(rr, 3), "#,##0")
    tb.cell(rr, 4, f"=IFERROR(C{rr}/SUM($C$32:$C$37),0)"); calc(tb.cell(rr, 4), "0.0%")
tb.conditional_formatting.add("C32:C37", DataBarRule(start_type="min", end_type="max", color="5B9BD5"))

widths = {"A": 2, "B": 31, "C": 13, "D": 11, "E": 14, "F": 11, "G": 11, "H": 12, "I": 12, "J": 10, "K": 11, "L": 11, "M": 10, "N": 11}
for k, v in widths.items(): tb.column_dimensions[k].width = v

ch = BarChart(); ch.type = "col"; ch.title = "TRS par machine"; ch.style = 10
ch.add_data(Reference(tb, min_col=13, min_row=12, max_row=17), titles_from_data=True)
ch.set_categories(Reference(tb, min_col=2, min_row=13, max_row=17))
ch.y_axis.number_format = "0%"; ch.y_axis.scaling.min = 0; ch.y_axis.scaling.max = 1
ch.legend = None; ch.height = 7.5; ch.width = 16
ch.dataLabels = DataLabelList(); ch.dataLabels.showVal = True; ch.dataLabels.showSerName = False; ch.dataLabels.showCatName = False; ch.dataLabels.showLegendKey = False
tb.add_chart(ch, "F30")

ch2 = BarChart(); ch2.type = "bar"; ch2.title = "Pertes par cause (min)"; ch2.style = 10
ch2.add_data(Reference(tb, min_col=3, min_row=31, max_row=37), titles_from_data=True)
ch2.set_categories(Reference(tb, min_col=2, min_row=32, max_row=37))
ch2.legend = None; ch2.height = 7.5; ch2.width = 16
tb.add_chart(ch2, "B40")

# ---------------- Évolution ----------------
ev = wb.create_sheet("Évolution")
title(ev, "Évolution journalière du TRS", "31 jours à partir de la date de début du tableau de bord (toutes machines).")
for j, h in enumerate(["Date", "Temps d'ouverture (min)", "Temps utile (min)", "TRS", "Objectif"], 1): hdr(ev.cell(4, j, h))
for i in range(31):
    rr = 5 + i
    ev.cell(rr, 1, f"='Tableau de bord'!$C$4+{i}"); calc(ev.cell(rr, 1), "dd/mm")
    ev.cell(rr, 2, f'=SUMIFS(Saisie!$D${R0}:$D${R1},Saisie!$A${R0}:$A${R1},A{rr})'); calc(ev.cell(rr, 2), "#,##0")
    # temps utile = somme(pièces bonnes x temps de cycle) via SUMPRODUCT
    ev.cell(rr, 3, f'=SUMIFS(Saisie!$R${R0}:$R${R1},Saisie!$A${R0}:$A${R1},A{rr})')
    calc(ev.cell(rr, 3), "#,##0")
    ev.cell(rr, 4, f'=IF(B{rr}=0,"",C{rr}/B{rr})'); calc(ev.cell(rr, 4), "0.0%")
    ev.cell(rr, 5, f'=IF(A{rr}>\'Tableau de bord\'!$C$5,"",Paramètres!$B$4)'); calc(ev.cell(rr, 5), "0%")
for col, w in zip("ABCDE", (10, 16, 16, 10, 10)): ev.column_dimensions[col].width = w
bc = BarChart(); bc.type = "col"; bc.title = "TRS journalier vs objectif"; bc.style = 10
bc.add_data(Reference(ev, min_col=4, min_row=4, max_row=35), titles_from_data=True)
bc.set_categories(Reference(ev, min_col=1, min_row=5, max_row=35))
bc.y_axis.number_format = "0%"; bc.y_axis.scaling.min = 0; bc.y_axis.scaling.max = 1
lo = LineChart(); lo.add_data(Reference(ev, min_col=5, min_row=4, max_row=35), titles_from_data=True)
bc += lo
bc.height = 9; bc.width = 22
lc = bc
ev.add_chart(lc, "G4")

for ws in wb.worksheets:
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape"; ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
tb.print_area = "A1:N56"; ev.print_area = "A1:T36"
wb.active = 3
wb.save("/home/claude/trs/Tableau_de_bord_TRS_OEE.xlsx")
print("saved", len(ex), "lignes exemple")
