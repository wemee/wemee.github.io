// File: reportslib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the Reports screens. Renders the appropriate
// title and report body based on parent.reportType, and wires the
// navigation / CSV-export buttons. Replaces the original frameset's
// inline document.write blocks (~35 calls) with template-driven population.

// Called by the router after tpl-reports is cloned into #app. Also
// invoked by showReport() to re-render in place when the user picks a
// different report type.
function init_reports() {
	var yr = parent.getGameYear();
	var type = parent.reportType;
	var titleText;

	switch (type) {
		case 0:
			titleText = '操作報表 - 第 ' + yr + ' 年';
			break;
		case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8:
			titleText = '組別報表 - 第 ' + yr + ' 年';
			break;
		case 9:
			titleText = '各組別報表 - 第 ' + yr + ' 年';
			break;
		default:
			titleText = '全部報表 - 第 ' + yr + ' 年';
			break;
	}
	document.getElementById('report-title').textContent = titleText;

	var bodyHTML;
	switch (type) {
		case 0:
			bodyHTML = parent.generateOperatorReport();
			break;
		case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8:
			bodyHTML = parent.generateTeamReport(type);
			break;
		case 9:
			bodyHTML = parent.generateTeamColumnReport();
			break;
		default:
			bodyHTML = '';
			var teams = parent.getTeams();
			for (var t = 1; t <= teams; t++) {
				bodyHTML += parent.generateTeamReport(t);
				if (t != teams) { bodyHTML += '<hr />'; }
			}
			bodyHTML += '<hr />' + parent.generateOperatorReport();
			break;
	}
	document.getElementById('report-body').innerHTML = bodyHTML;

	// 第一年沒有上一年可以回去，也還沒有歷史資料可以畫圖或匯出
	document.getElementById('report-year-actions').style.display = (yr > 1) ? '' : 'none';

	// Clear any CSV textarea from a previous showReport() pass
	var csvCell = document.getElementById('csv');
	if (csvCell) { csvCell.innerHTML = ''; }
}

function reviseTeams() {
	if (confirm('此操作會清除起始設定。\n確定要繼續嗎？')) {
		goto('teams');
	}
}

function showReport(t) {
	parent.reportType = t;
	init_reports();
}

function gotoDecisions() {
	goto('decisions');
}

function gotoPreviousYear() {
	parent.resumePreviousYear();
}

function teamGraphReports() {
	goto('graphs');
}

function generateCSVReport() {
	var csvReport = parent.generateCSVReportInfo() + "\n";
	csvReport += parent.generateTeamCSVReport() + "\n";
	csvReport += parent.generateOperatorCSVReport();

	var htmlStr = '<textarea rows="16" cols="75">' + csvReport + '</textarea>'
		+ '<p>複製貼到筆記本，副檔名改為.csv就可以用Excel開。(單機版網頁沒方法中的方法)</p>';
	document.getElementById("csv").innerHTML = htmlStr;
}
