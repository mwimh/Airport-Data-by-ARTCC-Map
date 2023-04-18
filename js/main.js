//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function () {
    //pseudo-global variables
    var attrArray = ["Millions of Passengers Departed", "Millions of Pounds of Cargo", "Miles (avg) to Landing per Passenger", "% of Flights Delayed", "% of Flights Cancelled"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    var domainArray = [49.35, 2.72]

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.45,
        chartHeight = chartWidth * 0.6 * (1 + 1 / 9),
        leftPadding = 45,
        rightPadding = 10,
        topBottomPadding = 10,
        chartHeightLess = chartHeight - topBottomPadding,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //begin script when window loads
    window.onload = setMap();

    //=====================================================================

    function setMap() {
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = width * 0.6;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on the continental United States
        var projection = d3.geoAlbers()
            .center([0, 38.5])
            .rotate([98.5, 0, 0])
            .parallels([20, 45])
            .scale(height * 1.9)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [];
        promises.push(d3.csv("data/ARTCCData.csv")); //load attributes from csv    
        promises.push(d3.json("data/ARTCCs.topojson")); //load choropleth spatial data    
        promises.push(d3.json("data/CONUS.topojson")); //load state overlays spatial data
        promises.push(d3.json("data/BackgroundCountries.topojson")); //load background country spatial data 
        promises.push(d3.json("data/points.topojson")); //load reference city points
        Promise.all(promises).then(callback);

        //assign data to variables
        function callback(data) {

            //assign variable names to data and overlays
            var csvData = data[0], artccsData = data[1], conusData = data[2], bGCount = data[3], cntrPoints = data[4];

            //place graticule on the map
            setGraticule(map, path);

            //translate spatial data back to TopoJSON
            var centersTopo = topojson.feature(artccsData, artccsData.objects.ARTCCs).features,
                statesTopo = topojson.feature(conusData, conusData.objects.CONUS),
                backCount = topojson.feature(bGCount, bGCount.objects.BackgroundCountries),
                pointsTopo = topojson.feature(cntrPoints, cntrPoints.objects.points).features;

            //add background countries to map
            var countries = map.append("path")
                .datum(backCount)
                .attr("class", "backgnd")
                .attr("d", path);

            //add background States to map for fill
            var bgstates = map.append("path")
                .datum(statesTopo)
                .attr("class", "bgstates")
                .attr("d", path);

            //join csv data to GeoJSON enumeration units
            centersTopo = joinData(centersTopo, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData)

/*
            //add city points overlay to map
            var points = map.append("path")
                .datum(pointsTopo)
                .attr("class", "points")
                .attr("d", path)
*/

            //add States overlay to map
            var states = map.append("path")
                .datum(statesTopo)
                .attr("class", "states")
                .attr("d", path);

            //create a text element for the chart title
            var mapTitle = map.append("text")
                .attr("x", width - 450)
                .attr("y", 45)
                .attr("class", "mapTitle")
                .attr("text-anchor", "start")
                .text("ARTCCs Ranked by Attribute");

            //add enumeration units to the map
            setEnumerationUnits(centersTopo, map, path, colorScale);

            //**************************************************************************************************************
            createPoints(pointsTopo, map, path);
            //**************************************************************************************************************

            setChart(csvData, colorScale);

            createDropdown(csvData);

            pageTitle()

        };
    };

    //=====================================================================

    function setGraticule(map, path) {
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
    };

    //=====================================================================

    function joinData(centersTopo, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i = 0; i < csvData.length; i++) {
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.IDENT; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a = 0; a < centersTopo.length; a++) {
                var geojsonProps = centersTopo[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.IDENT; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {
                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        return centersTopo;
    };

    //=====================================================================

    function setEnumerationUnits(centersTopo, map, path, colorScale) {
        //add ARTCC Centers to map
        var center = map.selectAll(".centers")
            .data(centersTopo)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "centers " + d.properties.IDENT;
            })
            .attr("d", path)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            })
            .on("mouseover.a", function (event, d) {
                highlight(d.properties);
            })
            .on("mouseover.b", function (event) {
                labelLegend();
            })
            //.on("mouseover.c", function (event, d) {
            //    infoBox(d.properties);
            //})
            .on("mouseout.a", function (event, d) {
                dehighlight(d.properties);
            })
            .on("mouseout.b", function (event) {
                labLegRemove();
            })
            //.on("mouseout.c", function (event) {
            //    infoBoxRemove();
            //})
            .on("click", function (event, d) {
                addedInfo(d.properties);
            })
            .on("mousemove", moveLabel)

        var desc = center.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');

    };


    //**************************************************************************************************************
    //=====================================================================

    function createPoints(pointsTopo, map, path) {
        //add city points overlay to map
        var points = map.selectAll(".points")
            .data(pointsTopo)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "points " + d.properties.cityName;
            })
            .attr("d", path)
            .on("mouseover", function (event, d) {
                //var c = 9;
                infoBox(d.properties.cityName);
                //console.log(d.properties.cityName);
                //console.log('run');
            })
            .on("mouseout.c", function (event) {
                infoBoxRemove();
            })
            .on("click", function (event, d) {
                addedInfo(d.properties);
            });
    };
    //**************************************************************************************************************


    //=====================================================================

    function makeColorScale(data) {
        var colorClasses = [
            '#f0f9e8',
            '#ccebc5',
            '#a8ddb5',
            '#7bccc4',
            '#4eb3d3',
            '#2b8cbe',
            '#08589e'
        ];
        //create color scale generator
        var colorScale = d3.scaleQuantile()
            .range(colorClasses);
        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };
        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);
        return colorScale;
    };

    //=====================================================================

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData) {
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Airport Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function (d) { return d })
            .text(function (d) { return d });
    };

    //=====================================================================

    //function to create coordinated bar chart
    function setChart(csvData, colorScale) {

        var yScale = d3.scaleLinear()
            .range([0, chartHeightLess - topBottomPadding])
            .domain([50, 0]);

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function (a, b) {
                return b[expressed] - a[expressed]
            })
            .attr("class", function (d) {
                return "bar " + d.IDENT;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover.a", function (event, d) {
                highlight(d);
            })
            .on("mouseover.b", function (event) {
                labelLegend();
            })
            .on("mouseout.a", function (event, d) {
                dehighlight(d);
            })
            .on("mouseout.b", function (event) {
                labLegRemove();
            })
            .on("click", function (event, d) {
                addedInfo(d);
            })
            .on("mousemove", moveLabel);


        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", chartWidth - 25)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .attr("text-anchor", "end")
            .text(expressed + " in Each ARTCC");

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);

        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

    };

    //=====================================================================

    // function to dynamically update the domain for different data sets
    function domainMinMax(attribute, csvData) {

        //create empty array
        minMaxArray = [];

        //put each data point from the selected CSV set into the array and sort the array from maximum to minimum
        for (var m = 0; m < csvData.length; m++) {
            minMaxArray.push(parseFloat(csvData[m][attribute]));
            minMaxArray.sort(function (a, b) {
                return b - a
            })
        };

        //name the first item in the sorted array as the maximum and the last item as the minimum, then store those two values as an array
        var attrMax = minMaxArray[0];
        var attrMin = minMaxArray[csvData.length - 1];
        domainArray = [attrMax, attrMin]

        return domainArray;

    }

    //=====================================================================

    //dropdown change event handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var center = d3.selectAll(".centers")
            .transition()
            .duration(800)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });

        var bars = d3.selectAll(".bar")
            //Sort bars
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function (d, i) {
                return i * 20
            })
            .duration(650);

        domainMinMax(attribute, csvData);

        updateChart(bars, csvData.length, colorScale);
    };

    //=====================================================================

    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale) {

        //determine if the minimum value is less than zero, if it is, set the domain minimum as 0 instead        
        if ((domainArray[1] - domainArray[0] * 0.1) < 0) {
            var domainMin = 0;
        } else domainMin = (domainArray[1] - domainArray[0] * 0.05);

        //dynamically upate the domain according to the range of values in the selected data set
        var yScale = d3.scaleLinear()
            .range([0, chartHeightLess - topBottomPadding])
            .domain([Math.round((domainArray[0] + domainArray[0] * 0.05)), domainMin]);

        //position bars
        bars.attr("x", function (d, i) {
            return i * (chartInnerWidth / n) + leftPadding;
        })
            //size/resize bars
            .attr("height", function (d, i) {
                return chartHeightLess - yScale(parseFloat(d[expressed])) - topBottomPadding;
            })
            .attr("y", function (d, i) {
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function (d) {
                var value = d[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            })

        //remove the previous axis so the new one can be drawn
        d3.select("#axisLine").remove()

        //draw the axis on the chart
        var chart = d3.select(".chart")
            .append("svg")

        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("id", "axisLine")
            .attr("transform", translate)
            .call(yAxis);

        //add text to chart title
        var chartTitle = d3.select(".chartTitle")
            .text(expressed + " per Airport");

    };

    //=====================================================================

    //function to highlight enumeration units and bars
    function highlight(props) {
        //change stroke
        var selected = d3.selectAll("." + props.IDENT)
            .style("stroke", "rgb(255, 205, 23)")
            .style("stroke-width", "4");

        setLabel(props);
    };

    //=====================================================================

    //function to reset the element style on mouseout
    function dehighlight(props) {
        var selected = d3.selectAll("." + props.IDENT)
            .style("stroke", function () {
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function () {
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName) {
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };

        d3.select(".infolabel")
            .remove();
    };

    //=====================================================================

    //function to create dynamic label
    function setLabel(props) {
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.IDENT + "_label")
            .html(labelAttribute);

        var centerName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.NAME + " ---   in the " + props.IDENT + " ARTCC");

        var moreInfo = centerName.append("div")
            .attr("class", "moreInfo")
            .html('Click the ARTCC, Airport, or Bar for more Airport Info!');
    };

    //=====================================================================

    //function to move info label with mouse
    function moveLabel() {
        //use coordinates of mousemove event to set label coordinates
        var x = event.clientX + 10,
            y = event.clientY - 75;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

    //=====================================================================
    //=====================================================================

    //function to create label Legend
    function labelLegend() {

        //create info label div
        var labLeg = d3.select("body")
            .append("div")
            .attr("class", "labLegend")
            .attr("id", "labelLegend")
            .html("<h1>###</h1><b> Selected Attribute</b>");

        var legInfo = labLeg.append("div")
            .attr("class", "labelname")
            .html("<i><b>Airport City</b></i> ---   in the <i><b>'ZZZZ'</b></i> ARTCC");
    };

    //=====================================================================

    function labLegRemove() {
        d3.select("#labelLegend").remove();
    }

    //=====================================================================

    //function to create dynamic info box
    function infoBox(props) {
        var infoContent = '<img src = "img/' + props + '.jpg"></img>';

        //create info label div
        var infoBox = d3.select("body")
            .append("div")
            .attr("class", "infoBox")
            .attr("id", "infoBoxId")
            .html(infoContent);
    };

    //=====================================================================

    function infoBoxRemove() {
        d3.select("#infoBoxId").remove();
    }

    //=====================================================================

    function addedInfo(props) {
        var url = 'https://www.airnav.com/airport/';
        url = url + props.ICAO_ID;
        window.open(url, '_blank');
    }

    //=====================================================================

    function pageTitle() {
        var titleText = d3.select("body")
            .append("div")
            .attr("class", "pageTitle")
            .html('<img src="img/webTitle.jpg"></img> &nbsp &nbsp &nbsp <span class="titleSub">Attributes of the Top Airports in each U.S. Air Route Traffic Control Center </span>');
            //.html('Busiest Airports in the United States - <span class="titleSub">Top Airport in each Air Route Traffic Control Center (ARTCC)</span>');

        var titleBkgnd = d3.select("body")
            .append("svg")
            .attr("class", "titleBack")
            .attr("width", window.innerWidth)

        var chartFrame = titleBkgnd.append("rect")
            .attr("class", "titleFrame")
            .attr("width", window.innerWidth)

    }

})(); //last line of main.js