var hot;
var data = [[""]]; //Necessary initial data array for HandsOnTable
var clusterize;

var currentSample = [];
var allSamples = [];
var samplesMean = [];
var responseVariableColumn = 0;

var scrollBindedFunction;
var mouseX;
var mouseY;

window.onload = function() {
  var container = document.getElementById('spreadsheet');
  hot = new Handsontable(container, {
    contextMenu: true,
    allowEmpty: false,
    minCols: 15,
    minRows: 15,
    minSpareCols: 1,
    minSpareRows: 1,
    data: data
  });

  hot.addHook("afterChange", function() {
    var stratify = document.getElementById("stratify");
    var variableList = document.getElementById("variable-list");
    variableList.innerHTML = "";
    stratify.innerHTML = "";

    stratify.insertAdjacentHTML("beforeend", "<option selected>None</option>"); //Add "None" to stratify variable dropdown menu

    var data = parseData();

    for(var i = 0; i < data[0].length; i++) {
      if(!!data[0][i]) { //Ignore empty heading cells
        stratify.insertAdjacentHTML("beforeend", "<option>" + data[0][i] + "</option>"); //Add first row headings to stratify dropdown menu, "None" is selected by default
        variableList.insertAdjacentHTML("beforeend", "<option" + (i === 0 ? " selected" : "") + ">" + data[0][i] + "</option>"); //Add first row headings to response variable dropdown menu
      }
    };
});

  google.charts.load('current', {packages: ['corechart']});

  document.getElementById("stratify").addEventListener("input", function() {
    reset();
  });

  document.getElementById("sample-size").addEventListener("input", function() {
    reset();
  });

  document.getElementById("variable-list").addEventListener("input", function() {
    reset();
  });

  document.getElementById("bin-size").addEventListener("blur", function() { //If type is "input", typing slows down too much because of repeated chart redraws
    prepareAllSamplesHistogramData();
    prepareMeanSamplesHistogramData();
  });
}

function sample() {
  var sampleSize = parseInt(document.getElementById("sample-size").value);
  var numSamples = parseInt(document.getElementById("num-samples").value);

  var data = parseData();

  if(!data[0]) return;

  responseVariableColumn = data[0].indexOf(document.getElementById("variable-list").value); //Get the column of the selected dropdown item

  //Check for valid inputs
  if((sampleSize > data.length - 1) || sampleSize < 1) {
    alert("You must choose a sample size that is between 1 and " + (data.length - 1) + ".");
    return;
  }

  if(numSamples <= 0) { //Check if numSamples is a positive integer
    alert("The number of samples must be integer.");
    return;
  }

  for(var i = 1; i < data.length; i++) { //Start at 1 to ignore column headings
    if(!parseInt(data[i][responseVariableColumn])) {
      alert("The response variable must be numeric, and the response variable column must be complete.");
      return;
    }
  }

  //Begin sampling

  for(var i = 0; i < numSamples; i++) {
    var currentSampleArray = [];
    var strata = getStrata();

    for(key in strata) { //Perform SRS on each individual stratum

      var size = Math.ceil((strata[key].length / data.length) * sampleSize); //Number of elements to select from each strata is proportional to strata size
      var stratifiedSampleArray = SRS(size, strata[key]);

      for(var j = 0; j < stratifiedSampleArray.length; j++) {
        currentSampleArray.push(stratifiedSampleArray[j]);
      }
    }

    var sampleValues = currentSampleArray.map(function(value, index) { //Get array of response variable column values
      return parseInt(value[responseVariableColumn]); //Retrieve data from column
    });

    samplesMean.push(jStat.mean(sampleValues));

    if(allSamples.length > 0) currentSampleArray.unshift(Array(currentSampleArray[0].length).fill("")); //Add empty row at end to separate samples
    allSamples = allSamples.concat(currentSampleArray);
}

  populateClusterizeTable();
  prepareAllSamplesHistogramData();
  prepareMeanSamplesHistogramData();
  logStatistics();
}

function getStrata() {
  var data = parseData();

  var stratifyColumn = data[0].indexOf(document.getElementById("stratify").value);
  responseVariableColumn = data[0].indexOf(document.getElementById("variable-list").value); //Get the column of the selected dropdown item

  var strata = {}; //Strata are keys

  for(var i = 1; i < data.length; i++) { //Start at 1 to ignore headings
    if(strata[data[i][stratifyColumn]] === undefined) strata[data[i][stratifyColumn]] = [];
    strata[data[i][stratifyColumn]].push(data[i]);
  }

  return strata;
}

function SRS(sampleSize, data) { //Function populates allSamples
  //Stops rows with blank cells from being processed, ignores entirely blank columns

  randomSampleNumbers = [];
  currentSample = [];

  if(sampleSize > data.length) {
    alert("You must choose a sample size that is smaller than " + data.length + ".");
    return;
  }

  for(var j = 0; j < sampleSize; j++) { //Generate random numbers
    randNum = Math.floor(Math.random() * data.length); //Random integer number on interval [0, data.length)

    while(randomSampleNumbers.indexOf(randNum) > -1) { //Regenerate until num is unique
      randNum = Math.floor(Math.random() * data.length);
    }
    randomSampleNumbers.push(randNum);
  }

  for(var j = 0; j < randomSampleNumbers.length; j++) {
    currentSample.push(data[randomSampleNumbers[j]]); //Add randomly selected rows to sample
  }

  return currentSample;
}

function prepareAllSamplesHistogramData() {
  var responseVariableData = allSamples.map(function(value, index) { //https://stackoverflow.com/a/12985968
      return [parseInt(value[responseVariableColumn])]; //Retrieve data from column, wrap in array
    }).filter(function(element) {
      return element === element;
    });

  responseVariableData = google.visualization.arrayToDataTable(responseVariableData, true); //Convert data array to data table

  drawHistogram(document.getElementById("histogram-samples"), responseVariableData, "Histogram of All Sampled Data");
}

function prepareMeanSamplesHistogramData() {
  var responseVariableData = samplesMean.map(function(value, index) {
      return [value]; //Wrap each data point in an array
    }).filter(function(element) {
      return element === element;
    });

  responseVariableData = google.visualization.arrayToDataTable(responseVariableData, true); //Convert data array to data table

  drawHistogram(document.getElementById("histogram-mean"), responseVariableData, "Histogram of Mean of all Samples");
}

function drawHistogram(element, responseVariableData, title) {
  var binSize = document.getElementById("bin-size").value;

  var options = {
    title: title,
    legend: { position: "none" },
    histogram: {
      bucketSize: parseInt(binSize) || "auto"
    }
  };

  var chart = new google.visualization.Histogram(element);
  chart.draw(responseVariableData, options);
}

function populateClusterizeTable() {
  var allSamplesData = [];
  var header = document.getElementById("all-samples-header");
  var clusterizeDiv = document.getElementById("content-area");

  var data = parseData();

  for(var i = 0; i < allSamples.length; i++) { //Loop through all rows
    var htmlString = "<tr>"; //Each row is wrapped in a tr
    for(var j = 0; j < allSamples[i].length; j++) {
      htmlString += "<td>" + allSamples[i][j] + "</td>"; //Each column is wrapped in a td
    }
    htmlString += "</tr>"; //Close current tr tag
    allSamplesData.push(htmlString);
  }

  header.innerHTML = ""; //Remove current table headings
  for(var i = 0; i < data[0].length; i++) {
    header.insertAdjacentHTML("beforeend", "<th>" + data[0][i] + "</th>"); //Add first row headings to table
  }

  if(!clusterize) {
    clusterize = new Clusterize({
      rows: allSamplesData,
      scrollId: "scroll-area",
      contentId: "content-area",
      rows_in_block: 10
    });
  } else clusterize.update(allSamplesData);

  document.getElementById("clusterize-table").style.display = "block";
}

function reset() {
  allSamples = []; //Clear all samples
  currentSample = [];
  samplesMean = [];

  document.getElementById("histogram-mean").innerHTML = ""; //Clear histograms
  document.getElementById("histogram-samples").innerHTML = "";

  if(clusterize) clusterize.update([]); //Clear data table
  document.getElementById("clusterize-table").style.display = "none";

  document.getElementById("number-of-samples").innerHTML = "";  //Clear statistics
  document.getElementById("mean").innerHTML = "";
  document.getElementById("standard-deviation").innerHTML = "";
}

function removeEmptyBorderCells(datas) {
  let data = datas.map(function(arr) {
    return arr.slice();
  });

  var emptyTable = true;
  for(var i = 0; i < data.length; i++) {
    for(var j = 0; j < data[i].length; j++) {
      if(data[i][j]) {
        emptyTable = false;
        break;
      }
    }
  }

  if(emptyTable) return data;

  var columns = [];

  for(var i = 0; i < data[0].length; i++) { //Loop through all columns, assumes width of first row is same throughout
    columns[i] = data.map(function(value, index) {
      return value[i];
    });
  }
  
  for(var i = 0; i < columns.length; i++) { //Loop through all rows to remove any empty columns, i represents the column index

    var columnEmpty = true;
    for(var j = 0; j < columns[i].length; j++) { //Check if every value in column is empty or null
      if(columns[i][j] !== "" && columns[i][j] !== null) {
        columnEmpty = false;
        break;
      }
    }

    if(columnEmpty) { //If column i in data set is empty
      for(var j = 0; j < data.length; j++) { //Loop through every row (index j) in data set to remove the empty column (index i)
        data[j].splice(i, 1); //Remove the ith column from every row
      }
      columns.splice(i, 1);
      i--;
    }
  }

  for(var i = 0; i < data.length; i++) { //Check for and remove empty rows

    var rowEmpty = true;
    for(var j = 0; j < data[i].length; j++) {
      if(data[i][j] !== "" && data[i][j] !== null) {
        rowEmpty = false;
        break;
      }
    }

    if(rowEmpty) {
      data.splice(i, 1); //Remove empty rows
      i--;
    }
  }

  return data;
}

function logStatistics() {
  var numSamples = document.getElementById("number-of-samples");
  var meanField = document.getElementById("mean");
  var standardDeviationField = document.getElementById("standard-deviation");

  numSamples.innerHTML = "Number of Samples: " + samplesMean.length;
  meanField.innerHTML = "Mean of Samples: " + jStat.mean(samplesMean); //Find overall mean of the means for each sample (not means for all data points)
  standardDeviationField.innerHTML = "Standard Deviation of Samples: " + jStat.stdev(samplesMean);
}

function saveData() {

  var tableIsEmpty = true;
  for(var i = 0; i < data.length; i++) {
    for(var j = 0; j < data[i].length; j++) {
      if(data[i][j]) {
        tableIsEmpty = false;
        break;
      }
    }
  }

  if(tableIsEmpty) {
    alert("Please input data to be saved.");
    return;
  }

  var dataSetName = prompt("Please enter the name of the data set that you want to save.");
  if(!dataSetName) return;

  //Stops rows with blank cells from being processed, ignores entirely blank columns
  var dataString = JSON.stringify(data);

  try {
    dataSetName = dataSetName.replace(/&/g, '&amp;') //Remove HTML tags from dataset name
            .replace(/"/g, '&quot;') //https://stackoverflow.com/a/20403618
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    localStorage.setItem(dataSetName, dataString);
  } catch (e) {
    if(e.name === "QuotaExceededError") {
      alert("The maximum storage size for saved data. Please delete your currently saved data and try again.");
    } else {
      alert("An error has occurred storing your data.");
    }
  }
}

function loadData() {
  if(localStorage.length === 0) {
    alert("There is no saved data.");
    return;
  }

  var popupDiv = document.createElement("div");
  popupDiv.id = "popup-div";

  popupDiv.insertAdjacentHTML("beforeend", "<div id = 'close-popup'>&#10006;</div>");

  popupDiv.insertAdjacentHTML("beforeend", "<ul id = 'saved-data-list'></ul>");
  document.body.appendChild(popupDiv);

  document.addEventListener("click", function(event) {
    if(event.target.id === "close-popup") {
      var popupDiv = document.getElementById("popup-div");
      if(popupDiv) popupDiv.parentNode.removeChild(popupDiv); //Event bubbles, so popupDiv may not exist
      document.removeEventListener('scroll', scrollBindedFunction);
    }
  });


  for(var key in localStorage) {
    var item = document.getElementById("saved-data-list").insertAdjacentHTML("beforeend", "<li class = 'popup-item'>" + key + "</li>");
  }

  scrollBindedFunction = noscroll.bind(this, document.documentElement.scrollTop);
  document.addEventListener('scroll', scrollBindedFunction);
}

document.addEventListener("click", function(event) {
  if(event.target && event.target.classList.contains("popup-item")) { //Needs to be contains() and not indexOf() because classList is NodeList
    reset();
    data = JSON.parse(localStorage.getItem(event.target.innerHTML));
    document.body.removeChild(document.getElementById("popup-div"));
    document.removeEventListener('scroll', scrollBindedFunction);

    hot.updateSettings({
      contextMenu: true,
      allowEmpty: false,
      data: data
    });
  }
});

function noscroll(y) {
  if(!!y) window.scrollTo(0, y);
}

document.addEventListener("keydown", function(event) {
  var popup = document.getElementById("popup-div");
  if((event.keyCode === 8 || event.keyCode === 46) && popup) { //Delete or backspace key pressed when popup is open, check for deletion of popup item
    var elements = document.querySelectorAll(".popup-item");
    for(var i = 0; i < elements.length; i++) {
      var coords = elements[i].getBoundingClientRect();
      if(mouseX >= coords.left && mouseX <= coords.right && mouseY >= coords.top && mouseY <= coords.bottom) { // (0, 0) is top left corner
        elements[i].parentNode.removeChild(elements[i]);
        localStorage.removeItem(elements[i].innerHTML);
        if(document.querySelectorAll(".popup-item").length === 0) {
          document.body.removeChild(popup);
          document.removeEventListener('scroll', scrollBindedFunction);
        }
        break;
      }
    };
  } else if(event.keyCode === 27 && popup) { //Escape key pressed when popup is open, exit popup
    document.body.removeChild(popup);
    document.removeEventListener('scroll', scrollBindedFunction);
  }
});

document.addEventListener("mousemove", function(event) {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

/*
Removes empty rows and columns from data
Removes rows with empty cell from data
returns new data set for processing
*/
function parseData() {
  return removeEmptyBorderCells(window.data).filter(function(element) { //Shadowed var has same name as gloabl var, so window.data is used to access global
    return element.toString() === element.filter(function(elem) { //Check if original array is same as filtered array
      return !!elem; //Filter out element if it is empty / blank
    }).toString();
  });
}