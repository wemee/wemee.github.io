// File: graphslib.js
// Author: 蔡至勇

function handleLoad() {

}

function goback() {
  location.replace("reports.html")
}

var colors = {
  fillColor: [
    null,
    "rgba(255,192,203,0.2)",
    "rgba(190,190,190,0.2)",
    "rgba(255,165,0,0.2)",
    "rgba(255,0,0,0.2)",
    "rgba(255,255,0,0.2)",
    "rgba(0,0,255,0.2)",
    "rgba(165,42,42,0.2)",
    "rgba(0,255,0,0.2)",
  ],
  strokeColor: [
    null,
    "rgba(255,192,203,1)",
    "rgba(190,190,190,1)",
    "rgba(255,165,0,1)",
    "rgba(255,0,0,1)",
    "rgba(255,255,0,1)",
    "rgba(0,0,255,1)",
    "rgba(165,42,42,1)",
    "rgba(0,255,0,1)",
  ],
  pointColor: [
    null,
    "rgba(255,192,203,1)",
    "rgba(190,190,190,1)",
    "rgba(255,165,0,1)",
    "rgba(255,0,0,1)",
    "rgba(255,255,0,1)",
    "rgba(0,0,255,1)",
    "rgba(165,42,42,1)",
    "rgba(0,255,0,1)",
  ],
  pointStrokeColor: [
    null,
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
  ],
  pointHighlightFill: [
    null,
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
    "#fff",
  ],
  pointHighlightStroke: [
    null,
    "rgba(255,192,203,1)",
    "rgba(190,190,190,1)",
    "rgba(255,165,0,1)",
    "rgba(255,0,0,1)",
    "rgba(255,255,0,1)",
    "rgba(0,0,255,1)",
    "rgba(165,42,42,1)",
    "rgba(0,255,0,1)",
  ],
  tableBackgroundColor: [
    null,
    "rgba(255,192,203,0.5)",
    "rgba(190,190,190,0.5)",
    "rgba(255,165,0,0.5)",
    "rgba(255,0,0,0.5)",
    "rgba(255,255,0,0.5)",
    "rgba(0,0,255,0.5)",
    "rgba(165,42,42,0.5)",
    "rgba(0,255,0,0.5)",
  ],
}

function drawIndices() {
  var shipIndicesJSON = parent.myStorage.getItem("shipIndices");
	if (shipIndicesJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var shipIndices = JSON.parse(shipIndicesJSON);
  shipIndices = shipIndices.slice(1);

  var catchIndicesJSON = parent.myStorage.getItem("catchIndices");
	if (catchIndicesJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var catchIndices = JSON.parse(catchIndicesJSON);
  catchIndices = catchIndices.slice(1);

  var fishIndicesJSON = parent.myStorage.getItem("fishIndices");
	if (fishIndicesJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var fishIndices = JSON.parse(fishIndicesJSON);
  fishIndices = fishIndices.slice(1);

  var ctx = document.getElementById("indicesChart").getContext("2d");

  var gameYear = parent.getGameYear();
  var labels = new Array();
  for (var y=1; y<=gameYear; y++) {
    labels.push(y);
  }
  var data = {
      labels: labels,
      datasets: [
          {
              label: "船指數",
              fillColor: colors['fillColor'][1],
              strokeColor: colors['strokeColor'][1],
              pointColor: colors['pointColor'][1],
              pointStrokeColor: colors['pointStrokeColor'][1],
              pointHighlightFill: colors['pointHighlightFill'][1],
              pointHighlightStroke: colors['pointHighlightStroke'][1],
              data: shipIndices
          },
          {
              label: "​捕獲指數",
              fillColor: colors['fillColor'][2],
              strokeColor: colors['strokeColor'][2],
              pointColor: colors['pointColor'][2],
              pointStrokeColor: colors['pointStrokeColor'][2],
              pointHighlightFill: colors['pointHighlightFill'][2],
              pointHighlightStroke: colors['pointHighlightStroke'][2],
              data: fishIndices
          },
          {
              label: "​魚群指數",
              fillColor: colors['fillColor'][3],
              strokeColor: colors['strokeColor'][3],
              pointColor: colors['pointColor'][3],
              pointStrokeColor: colors['pointStrokeColor'][3],
              pointHighlightFill: colors['pointHighlightFill'][3],
              pointHighlightStroke: colors['pointHighlightStroke'][3],
              data: catchIndices
          }
      ]
  };

  var options = {
      //Boolean - Whether to fill the dataset with a colour
      datasetFill : false,
      // legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].strokeColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>"
      // legendTemplate : '<p>TEST</p>'
  };
  // document.getElementById('indicesChart-legend').innerHTML = (new Chart(ctx).Line(data, options)).generateLegend();
  new Chart(ctx).Line(data, options);

  // Draw Table
  var tableHtmlHeaderStr = "<table border='1'><tr><td align='center'>年</td>";
  for (var y=1; y<=gameYear; y++) {
    tableHtmlHeaderStr += "<td align='center'>" + y + "</td>";
  }
  tableHtmlHeaderStr += "</tr>";

  var tableHtmlStr = tableHtmlHeaderStr;

  var shipIndexHtmlStr = "";
  var fishIndexHtmlStr = "";
  var catchIndexHtmlStr = "";
  for (var y=1; y<=gameYear; y++) {
    shipIndexHtmlStr += "    <td align='center'>" + shipIndices[y-1] + "</td>";
    fishIndexHtmlStr += "    <td align='center'>" + fishIndices[y-1] + "</td>";
    catchIndexHtmlStr += "    <td align='center'>" + catchIndices[y-1] + "</td>";
  }
  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][1] + "'><td align='center'>船指數</td>" + shipIndexHtmlStr + "</tr>";
  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][2] + "'><td align='center'>​捕獲指數</td>" + fishIndexHtmlStr + "</tr>";
  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][3] + "'><td align='center'>​魚群指數</td>" + catchIndexHtmlStr + "</tr>";
  tableHtmlStr += "</table>"

  document.getElementById("indicesTable").innerHTML = tableHtmlStr;
}

function drawBanBals() {
  var teamBankBalDataJSON = parent.myStorage.getItem("teamBankBalData");
  var teamShipsDataJSON = parent.myStorage.getItem("teamShipsData");
  var teamAssetsDataJSON = parent.myStorage.getItem("teamAssetsData");
	if (teamBankBalDataJSON == "" || teamShipsDataJSON == "" || teamAssetsDataJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var teamBankBalData = JSON.parse(teamBankBalDataJSON);
  var teamShipsData = JSON.parse(teamShipsDataJSON);
  var teamAssetsData = JSON.parse(teamAssetsDataJSON);

  var shipsCtx = document.getElementById("shipsChart").getContext("2d");
  var banBalCtx = document.getElementById("banBalsChart").getContext("2d");
  var assetsCtx = document.getElementById("assetsChart").getContext("2d");

  var gameYear = parent.getGameYear();
  var labels = new Array();
  for (var y=1; y<=gameYear; y++) {
    labels.push(y);
  }

  var shipsCtxData;
  var banBalCtxData;
  var assetsCtxData;

  shipsCtxData = {
    labels: labels,
    datasets: (function(){
      var result = new Array();
      for(var t=1, teams=parent.getTeams(); t<=teams; t++){
        result.push({
          label: t,
          fillColor: colors['fillColor'][t],
          strokeColor: colors['strokeColor'][t],
          pointColor: colors['pointColor'][t],
          pointStrokeColor: colors['pointStrokeColor'][t],
          pointHighlightFill: colors['pointHighlightFill'][t],
          pointHighlightStroke: colors['pointHighlightStroke'][t],
          data: teamShipsData[t].slice(1)
        });
      }
      return result;
    })()
  };

  banBalCtxData = {
    labels: labels,
    datasets: (function(){
      var result = new Array();
      for(var t=1, teams=parent.getTeams(); t<=teams; t++){
        result.push({
          label: t,
          fillColor: colors['fillColor'][t],
          strokeColor: colors['strokeColor'][t],
          pointColor: colors['pointColor'][t],
          pointStrokeColor: colors['pointStrokeColor'][t],
          pointHighlightFill: colors['pointHighlightFill'][t],
          pointHighlightStroke: colors['pointHighlightStroke'][t],
          data: teamBankBalData[t].slice(1)
        });
      }
      return result;
    })()
  };
  assetsCtxData = {
    labels: labels,
    datasets: (function(){
      var result = new Array();
      for(var t=1, teams=parent.getTeams(); t<=teams; t++){
        result.push({
          label: t,
          fillColor: colors['fillColor'][t],
          strokeColor: colors['strokeColor'][t],
          pointColor: colors['pointColor'][t],
          pointStrokeColor: colors['pointStrokeColor'][t],
          pointHighlightFill: colors['pointHighlightFill'][t],
          pointHighlightStroke: colors['pointHighlightStroke'][t],
          data: teamAssetsData[t].slice(1)
        });
      }
      return result;
    })()
  };

  var options = {datasetFill : false};
  // document.getElementById('shipsChart-legend').innerHTML = (new Chart(shipsCtx).Line(shipsCtxData, options)).generateLegend();
  new Chart(shipsCtx).Line(shipsCtxData, options);
  // document.getElementById('banBalsChart-legend').innerHTML = (new Chart(banBalCtx).Line(banBalCtxData, options)).generateLegend();
  new Chart(banBalCtx).Line(banBalCtxData, options);
  // document.getElementById('assetsChart-legend').innerHTML = (new Chart(assetsCtx).Line(assetsCtxData, options)).generateLegend();
  new Chart(assetsCtx).Line(assetsCtxData, options);

  ///////////////////////////////////////////////////////////////////////////////////////////////////
  // csv comment 8871231 // Draw Table And CSV
  // var indicesTable = document.getElementById("indicesTable");

  // 總資產
  // csv comment 8871231 var csvStr = '總資產\n';
  // csv comment 8871231 var csvYearStr = ',';
  var tableHtmlHeaderStr = "<table border='1'><tr><td align='center'>年</td>";
  for (var y=1; y<=gameYear; y++) {
    tableHtmlHeaderStr += "<td align='center'>" + y + "</td>";
    // csv comment 8871231 csvYearStr += (y + ",");
  }
  tableHtmlHeaderStr += "</tr>";
  // csv comment 8871231 csvYearStr += "\n";
  // csv comment 8871231 csvStr += csvYearStr;

  var tableHtmlStr = tableHtmlHeaderStr;

  for(var t=1, teams=parent.getTeams(); t<=teams; t++){
    tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][t] + "'><td align='center'>" + t + "</td>";
    // csv comment 8871231 csvStr += t + ","
    for (var y=1; y<=gameYear; y++) {
      tableHtmlStr += "    <td align='center'>" + teamAssetsData[t][y] + "</td>";
      // csv comment 8871231 csvStr += teamAssetsData[t][y-1] + ","
    }
    tableHtmlStr += "</tr>";
    // csv comment 8871231 csvStr += "\n";
  }
  tableHtmlStr += "</table>"
  document.getElementById("assetsTable").innerHTML = tableHtmlStr;

  // 船數
  // csv comment 8871231 csvStr += '\n船數\n';
  // csv comment 8871231 csvStr += csvYearStr;
  tableHtmlStr = tableHtmlHeaderStr;
  tableHtmlStr += "</tr>";
  for(var t=1, teams=parent.getTeams(); t<=teams; t++){
    tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][t] + "'><td align='center'>" + t + "</td>";
    // csv comment 8871231 csvStr += t + ","
    for (var y=1; y<=gameYear; y++) {
      tableHtmlStr += "    <td align='center'>" + teamShipsData[t][y] + "</td>";
      // csv comment 8871231 csvStr += teamShipsData[t][y-1] + ","
    }
    tableHtmlStr += "</tr>";
    // csv comment 8871231 csvStr += "\n";
  }
  tableHtmlStr += "</table>"
  document.getElementById("shipsTable").innerHTML = tableHtmlStr;

  // 資金
  // csv comment 8871231 csvStr += '\n資金\n';
  // csv comment 8871231 csvStr += csvYearStr;
  tableHtmlStr = tableHtmlHeaderStr;
  tableHtmlStr += "</tr>";
  for(var t=1, teams=parent.getTeams(); t<=teams; t++){
    tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][t] + "'><td align='center'>" + t + "</td>";
    // csv comment 8871231 csvStr += t + ","
    for (var y=1; y<=gameYear; y++) {
      tableHtmlStr += "    <td align='center'>" + teamBankBalData[t][y] + "</td>";
      // csv comment 8871231 csvStr += teamBankBalData[t][y-1] + ","
    }
    tableHtmlStr += "</tr>";
    // csv comment 8871231 csvStr += "\n";
  }

  tableHtmlStr += "</table>"
  document.getElementById("banBalsTable").innerHTML = tableHtmlStr;
  // csv comment 8871231 document.getElementById("csv").value += csvStr;
}

function drawFishPop() {
  var fishPopDeepDataJSON = parent.myStorage.getItem("fishPopDeepData");
  var fishPopCoastDataJSON = parent.myStorage.getItem("fishPopCoastData");
	if (fishPopDeepDataJSON == "" || fishPopCoastDataJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var fishPopDeepData = JSON.parse(fishPopDeepDataJSON);
  var fishPopCoastData = JSON.parse(fishPopCoastDataJSON);
  fishPopDeepData = fishPopDeepData.slice(1);
  fishPopCoastData = fishPopCoastData.slice(1);

  var ctx = document.getElementById("fishPopChart").getContext("2d");

  var gameYear = parent.getGameYear();
  var labels = new Array();
  for (var y=1; y<=gameYear; y++) {
    labels.push(y);
  }

  var data = {
    labels: labels,
    datasets: [
      {
        label: "遠洋",
        fillColor: colors['fillColor'][1],
        strokeColor: colors['strokeColor'][1],
        pointColor: colors['pointColor'][1],
        pointStrokeColor: colors['pointStrokeColor'][1],
        pointHighlightFill: colors['pointHighlightFill'][1],
        pointHighlightStroke: colors['pointHighlightStroke'][1],
        data: fishPopDeepData
      },{
        label: "近海",
        fillColor: colors['fillColor'][2],
        strokeColor: colors['strokeColor'][2],
        pointColor: colors['pointColor'][2],
        pointStrokeColor: colors['pointStrokeColor'][2],
        pointHighlightFill: colors['pointHighlightFill'][2],
        pointHighlightStroke: colors['pointHighlightStroke'][2],
        data: fishPopCoastData
      }
    ]
  };

  var options = {datasetFill : false};
  // document.getElementById('fishPopChart-legend').innerHTML = (new Chart(ctx).Line(data, options)).generateLegend();
  new Chart(ctx).Line(data, options);

  ///////////////////////////////////////////////////////////////////////////////////////////////////
  // Draw Table
  // csv comment 8871231 var csvStr = '\n魚群數量\n';
  // csv comment 8871231 var csvYearStr = ',';
  var tableHtmlHeaderStr = "<table border='1'><tr><td align='center'>年</td>";
  for (var y=1; y<=gameYear; y++) {
    tableHtmlHeaderStr += "<td align='center'>" + y + "</td>";
    // csv comment 8871231 csvYearStr += (y + ",");
  }
  tableHtmlHeaderStr += "</tr>";
  // csv comment 8871231 csvYearStr += "\n";
  // csv comment 8871231 csvStr += csvYearStr;

  var tableHtmlStr = tableHtmlHeaderStr;

  // csv comment 8871231 var fishPopDeepDataCSVStr = "";
  // csv comment 8871231 var fishPopCoastDataCSVStr = "";

  var fishPopDeepDataHtmlStr = "";
  var fishPopCoastDataHtmlStr = "";
  for (var y=1; y<=gameYear; y++) {
    // csv comment 8871231 fishPopDeepDataCSVStr += fishPopDeepData[y-1] + ",";
    // csv comment 8871231 fishPopCoastDataCSVStr += fishPopCoastData[y-1] + ",";
    fishPopDeepDataHtmlStr += "    <td align='center'>" + fishPopDeepData[y-1] + "</td>";
    fishPopCoastDataHtmlStr += "    <td align='center'>" + fishPopCoastData[y-1] + "</td>";
  }
  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][1] + "'><td align='center'>遠洋</td>" + fishPopDeepDataHtmlStr + "</tr>";
  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][2] + "'><td align='center'>近海</td>" + fishPopCoastDataHtmlStr + "</tr>";
  // csv comment 8871231 csvStr += "遠洋," + fishPopDeepDataCSVStr + "\n";
  // csv comment 8871231 csvStr += "近海," + fishPopCoastDataCSVStr + "\n";

  tableHtmlStr += "</table>"
  document.getElementById("fishPopTable").innerHTML = tableHtmlStr;
  // csv comment 8871231 document.getElementById("csv").value += csvStr;
}

function drawFishDensity() {
  var fishDensityDeepDataJSON = parent.myStorage.getItem("fishDensityDeepData");
  var fishDensityCoastDataJSON = parent.myStorage.getItem("fishDensityCoastData");
	if (fishDensityDeepDataJSON == "" || fishDensityCoastDataJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var fishDensityDeepData = JSON.parse(fishDensityDeepDataJSON);
  var fishDensityCoastData = JSON.parse(fishDensityCoastDataJSON);
  fishDensityDeepData = fishDensityDeepData.slice(1);
  fishDensityCoastData = fishDensityCoastData.slice(1);

  var ctx = document.getElementById("fishDensityChart").getContext("2d");

  var gameYear = parent.getGameYear();
  var labels = new Array();
  for (var y=1; y<=gameYear; y++) {
    labels.push(y);
  }

  var data = {
    labels: labels,
    datasets: [
      {
        label: "遠洋",
        fillColor: colors['fillColor'][1],
        strokeColor: colors['strokeColor'][1],
        pointColor: colors['pointColor'][1],
        pointStrokeColor: colors['pointStrokeColor'][1],
        pointHighlightFill: colors['pointHighlightFill'][1],
        pointHighlightStroke: colors['pointHighlightStroke'][1],
        data: fishDensityDeepData
      },{
        label: "近海",
        fillColor: colors['fillColor'][2],
        strokeColor: colors['strokeColor'][2],
        pointColor: colors['pointColor'][2],
        pointStrokeColor: colors['pointStrokeColor'][2],
        pointHighlightFill: colors['pointHighlightFill'][2],
        pointHighlightStroke: colors['pointHighlightStroke'][2],
        data: fishDensityCoastData
      }
    ]
  };

  var options = {datasetFill : false};
  // document.getElementById('fishDensityChart-legend').innerHTML = (new Chart(ctx).Line(data, options)).generateLegend();
  new Chart(ctx).Line(data, options);

  ///////////////////////////////////////////////////////////////////////////////////////////////////
  // Draw Table
  // csv comment 8871231 var csvStr = '\n魚群密度\n';
  // csv comment 8871231 var csvYearStr = ',';
  var tableHtmlHeaderStr = "<table border='1'><tr><td align='center'>年</td>";
  for (var y=1; y<=gameYear; y++) {
    tableHtmlHeaderStr += "<td align='center'>" + y + "</td>";
    // csv comment 8871231 csvYearStr += (y + ",");
  }
  tableHtmlHeaderStr += "</tr>";
  // csv comment 8871231 csvYearStr += "\n";
  // csv comment 8871231 csvStr += csvYearStr;

  var tableHtmlStr = tableHtmlHeaderStr;

  // csv comment 8871231 var fishDensityDeepDataCSVStr = "";
  // csv comment 8871231 var fishDensityCoastDataCSVStr = "";
  var fishDensityDeepDataHtmlStr = "";
  var fishDensityCoastDataHtmlStr = "";
  for (var y=1; y<=gameYear; y++) {
    // csv comment 8871231 fishDensityDeepDataCSVStr += fishDensityDeepData[y-1] + ",";
    // csv comment 8871231 fishDensityCoastDataCSVStr += fishDensityCoastData[y-1] + ",";
    fishDensityDeepDataHtmlStr += "    <td align='center'>" + fishDensityDeepData[y-1] + "</td>";
    fishDensityCoastDataHtmlStr += "    <td align='center'>" + fishDensityCoastData[y-1] + "</td>";
  }

  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][1] + "'><td align='center'>遠洋</td>" + fishDensityDeepDataHtmlStr + "</tr>";
  tableHtmlStr += "<tr style='background-color: " + colors['tableBackgroundColor'][2] + "'><td align='center'>近海</td>" + fishDensityCoastDataHtmlStr + "</tr>";
  // csv comment 8871231 csvStr += "遠洋," + fishDensityDeepDataCSVStr + "\n";
  // csv comment 8871231 csvStr += "近海," + fishDensityCoastDataCSVStr + "\n";

  tableHtmlStr += "</table>"
  document.getElementById("fishDensityTable").innerHTML = tableHtmlStr;
  // csv comment 8871231 document.getElementById("csv").value += csvStr;
}

// salvageValueTable
function drawSalvageValue() {
  var salvageValuesJSON = parent.myStorage.getItem("salvageValues");
	if (salvageValuesJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}
  var salvageValues = JSON.parse(salvageValuesJSON);
  salvageValues = salvageValues.slice(1);
  var ctx = document.getElementById("salvageValueChart").getContext("2d");

  var gameYear = parent.getGameYear();
  var labels = new Array();
  for (var y=1; y<=gameYear; y++) {
    labels.push(y);
  }

  var data = {
    labels: labels,
    datasets: [
      {
        label: "魚船殘值",
        fillColor: colors['fillColor'][1],
        strokeColor: colors['strokeColor'][1],
        pointColor: colors['pointColor'][1],
        pointStrokeColor: colors['pointStrokeColor'][1],
        pointHighlightFill: colors['pointHighlightFill'][1],
        pointHighlightStroke: colors['pointHighlightStroke'][1],
        data: salvageValues
      }
    ]
  };

  var options = {datasetFill : false};
  // document.getElementById('salvageValueChart-legend').innerHTML = (new Chart(ctx).Line(data, options)).generateLegend();
  new Chart(ctx).Line(data, options);

  ///////////////////////////////////////////////////////////////////////////////////////////////////
  // Draw Table
  // csv comment 8871231 var csvStr = '\n魚船折現價\n';
  // csv comment 8871231 var csvYearStr = '';
  var tableHtmlHeaderStr = "<table border='1'><tr><td align='center'>年</td>";
  for (var y=1; y<=gameYear; y++) {
    tableHtmlHeaderStr += "<td align='center'>" + y + "</td>";
    // csv comment 8871231 csvYearStr += (y + ",");
  }
  tableHtmlHeaderStr += "</tr>";
  // csv comment 8871231 csvYearStr += "\n";
  // csv comment 8871231 csvStr += csvYearStr;

  var tableHtmlStr = tableHtmlHeaderStr+"<td></td>";
  for (var y=1; y<=gameYear; y++) {
    tableHtmlStr += "    <td align='center'>" + salvageValues[y-1] + "</td>";
    // csv comment 8871231 csvStr +=  salvageValues[y-1] + ",";
  }
  tableHtmlStr += "</tr>";
  // csv comment 8871231 csvStr += "\n";

  tableHtmlStr += "</table>"
  document.getElementById("salvageValueTable").innerHTML = tableHtmlStr;
  // csv comment 8871231 document.getElementById("csv").value += csvStr;
}

function addEvent(evnt, elem, func) {
   if (elem.addEventListener)  // W3C DOM
      elem.addEventListener(evnt,func,false);
   else if (elem.attachEvent) { // IE DOM
      elem.attachEvent("on"+evnt, func);
   }
   else { // No much to do
      elem[evnt] = func;
   }
}

// addEvent("DOMContentLoaded", document, function(event) {
  // drawIndices();
  // drawBanBals();
  // drawSalvageValue();
  // drawFishPop();
  // drawFishDensity();
// });

function drawAllGraphs(){
  drawIndices();
  drawBanBals();
  drawSalvageValue();
  drawFishPop();
  drawFishDensity();
}

document.addEventListener("DOMContentLoaded", function(event) {
  drawAllGraphs();
});
