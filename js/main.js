//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function () {
    //pseudo-global variables
    var attrArray = ["Million Passengers Departed", "Million Pounds of Cargo", "Miles (avg) to Landing per Passenger", "% of Flights Delayed", "% of Flights Cancelled"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    var domainArray = [49.35, 2.72] //min and max domain array for initial attribute

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.45, //set chart width based on window dimensions
        chartHeight = chartWidth * 0.6 * (1 + 1 / 9), //set chart height based on window dimensions
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

        //create map
        var path = d3.geoPath()
            .projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [];
        promises.push(d3.csv("data/ARTCCData.csv")); //load attributes from csv    
        promises.push(d3.json("data/ARTCCs.topojson")); //load choropleth spatial data    
        promises.push(d3.json("data/CONUS.topojson")); //load state overlays spatial data
        promises.push(d3.json("data/BackgroundCountries.topojson")); //load background country spatial data 
        promises.push(d3.json("data/points.topojson")); //load airport location points
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

            //add States overlay to map
            var states = map.append("path")
                .datum(statesTopo)
                .attr("class", "states")
                .attr("d", path);

            //create background for map title
            var mapTitleBack = map.append("rect")
                .attr("class", "mapTitleBack")
                .attr("width", 720)
                .attr("height", 40)
                .attr("x", 0)
                .attr("y", 0)

            //create a text element for the chart title
            var mapTitle = map.append("text")
                .attr("x", 20)
                .attr("y", 30)
                .attr("class", "mapTitle")
                .attr("text-anchor", "start")
                .text("ARTCCs Ranked by Attribute:");

            //add enumeration units to the map
            setEnumerationUnits(centersTopo, map, path, colorScale);
            //add airport locations as points to map
            createPoints(pointsTopo, map, path);
            //set chart attributes
            setChart(csvData, colorScale);
            //create attribute dropdown
            createDropdown(csvData);
            //generate static text and image elements on page
            pageTitle()

        };
    };

    //=====================================================================

    //generate graticule for the map
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
        //add ARTCC Centers to map and create events on mouseover, mouseout, and click
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
                labelLegend(); //add static label legend
            })
            .on("mouseout.a", function (event, d) {
                dehighlight(d.properties);
            })
            .on("mouseout.b", function (event) {
                labLegRemove(); //remove static label legend
            })
            .on("click", function (event, d) {
                addedInfo(d.properties); //open new window with airport info on click
            })
            .on("mousemove", moveLabel)

        //add original style descriptor
        var desc = center.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };

    //=====================================================================

    //function to create points for each airport and events on mouseover, mouseout, and click
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
                infoBox(d.properties.cityName); //add airport picture on mouseover
            })
            .on("mouseout.c", function (event) {
                infoBoxRemove(); //remove airport picture on mouseout
            })
            .on("click", function (event, d) {
                addedInfo(d.properties); //open new window with airport info on click
            });
    };

    //=====================================================================

    //function to generate color scale based on data in the CSV file
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

        //set the initial range and domain
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

        //set bars for each province and events on mouseover, mouseout, and click
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
                labelLegend(); //add static label legend
            })
            .on("mouseout.a", function (event, d) {
                dehighlight(d);
            })
            .on("mouseout.b", function (event) {
                labLegRemove(); //remove static label legend
            })
            .on("click", function (event, d) {
                addedInfo(d); //open new window with airport info on click
            })
            .on("mousemove", moveLabel);

        //create background for the chart title
        var chartTitleBack = chart.append("rect")
            .attr("class", "chartTitleBack")
            .attr("width", 580)
            .attr("height", 40)
            .attr("x", chartInnerWidth - 580 + leftPadding)
            .attr("y", topBottomPadding)

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("text-anchor", "middle")
            .attr("x", chartInnerWidth - 290 + leftPadding)
            .attr("y", 37)
            .attr("class", "chartTitle")
            .text(expressed + " in Each ARTCC");

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);

        //add original style descriptor
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
                return b - a;
            })
        };

        //name the first item in the sorted array as the maximum and the last item as the minimum, then store those two values as another array
        var attrMax = minMaxArray[0];
        var attrMin = minMaxArray[csvData.length - 1];
        domainArray = [attrMax, attrMin];

        //return the array containing the attribute minimum and maximum to set the domain in other functions
        return domainArray;
    };

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

        //recolor bars
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

        //calculate the minimum and maximum of the attribute data set
        domainMinMax(attribute, csvData);

        //update the chart with the new data
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

        //remove the infolabel
        d3.select(".infolabel")
            .remove();
    };

    //=====================================================================

    //function to create dynamic label
    function setLabel(props) {
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label popup
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.IDENT + "_label")
            .html(labelAttribute);

        //add additional text to the popup
        var centerName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.NAME + " ---   in the " + props.IDENT + " ARTCC");

        //add text to inform user to click for more info
        var moreInfo = centerName.append("div")
            .attr("class", "moreInfo")
            .html('Click the ARTCC, Airport, or Bar for detailed airport info!');
    };

    //=====================================================================

    //function to move info label with mouse
    function moveLabel() {
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

    //=====================================================================

    //function to create label legend that explains elements of the popup
    function labelLegend() {

        //create info label legend
        var labLeg = d3.select("body")
            .append("div")
            .attr("class", "labLegend")
            .attr("id", "labelLegend")
            .html("<h1>###</h1><b> Selected Attribute</b>");

        //add additional text to the legend
        var legInfo = labLeg.append("div")
            .attr("class", "labelname")
            .html("<i><b>Airport City</b></i> ---   in the <i><b>'ZZZ'</b></i> ARTCC");
    };

    //=====================================================================

    //remove the label legend
    function labLegRemove() {
        d3.select("#labelLegend").remove();
    }

    //=====================================================================

    //function to create dynamic info/picture box
    function infoBox(props) {
        var infoContent = '<img src = "img/' + props + '.jpg"></img>'; //specify location of image for popup

        //create info/picture box
        var infoBox = d3.select("body")
            .append("div")
            .attr("class", "infoBox")
            .attr("id", "infoBoxId")
            .style("top", (chartHeight) + "px")
            .html(infoContent);
    };

    //=====================================================================

    //remove the info box when complete
    function infoBoxRemove() {
        d3.select("#infoBoxId").remove();
    }

    //=====================================================================

    //open new window at airnav.com for each airport when clicked
    function addedInfo(props) {
        var url = 'https://www.airnav.com/airport/';
        url = url + props.ICAO_ID;
        window.open(url, '_blank');
    }

    //=====================================================================

    //function to create various text and background elements on the page
    function pageTitle() {

        //create overall page title
        var titleText = d3.select("body")
            .append("div")
            .attr("class", "pageTitle")
            .html('<img src="img/webTitle.jpg"></img>  &nbsp &nbsp <span class="titleSub">Attributes of the Top Airports in each U.S. Air Route Traffic Control Center (ARTCC) in 2015</span>');

        //add background to title
        var titleBkgnd = d3.select("body")
            .append("svg")
            .attr("class", "titleBack")
            .attr("height", 70 + "px")
            .attr("width", window.innerWidth)

        //add frame to title
        var titleFrame = titleBkgnd.append("rect")
            .attr("class", "titleFrame")
            .attr("width", window.innerWidth)

        //add background to metadata
        var metaBkgnd = d3.select("body")
            .append("svg")
            .attr("class", "metaBack")
            .attr("height", 98 + "px")
            .attr("width", window.innerWidth)

        //create metadata text
        var metadata = d3.select("body")
            .append("div")
            .attr("class", "metadata")
            .attr("text-anchor", "right")
            .html('<p align=right>Created by Michael Imhoff for U.W. - Madison - Geography 575 - Spring 2023</p><p align=right>Mapped Data & Attributes from the FAA & Bureau of Transportation Statistics</p><p align=right>Basemap shapefiles from Natural Earth; ARTCC Boundaries & Airport Locations from the FAA</p><p align=right>Airport Images & Information from https://www.airnav.com/airports/</p><p>Map Projection: Albers Equal Area Conic - Central Meridian: 98.5°W - Standard Parallels: 20°N & 45°N</p>');

        //add background to metadata
        var addInfoBkgnd = d3.select("body")
            .append("svg")
            .attr("class", "addInfoBack")
            .style("top", (chartHeight + 125) + "px")
            .style("left", (window.innerWidth * 0.2) + "px")

        //create metadata text
        var addInfo = d3.select("body")
            .append("div")
            .attr("class", "addInfo")
            .attr("text-anchor", "left")
            .style("top", (chartHeight + 125) + "px")
            .style("left", (window.innerWidth * 0.2 + 15) + "px")
            .html('<p align=left>Air Route Traffic Control Centers (ARTCCs) are facilities in the United States responsible for controlling all types of aircraft flying between the surface and 60,000 feet while outside of controlled airspace around airports. ARTCCs typically cover a geographic area that is topographically, climatologically, and culturally distinct from those around it. This means that each area has unique attributes that impact commercial aviation in different ways. Examples of these distinctions are highlighted in the attributes shown in the above map and bar chart.  The total number of passengers departing often correlates to the size of major cities in the ARTCC. Cargo transport is spread relatively evenly between each coast. Miles flown per passenger, or how far on average each departing passenger flies before their next landing, are highest on the coasts, where many flights cross oceans, with Pacific crossing flights being longer than those crossing the Atlantic. Flight delays are more common in the midwest, where strong spring and summer thunderstorms cause brief delays without cancellations, while strong, long-lasting storms in the Northeast cause widespread flight cancellations.</p>');

        //place map legend image
        var mapLegend = d3.select("body")
            .append("div")
            .attr("class", "mapLegend")
            .html('<img src="img/mapLegend.jpg"></img>')
    }

})(); //last line of main.js