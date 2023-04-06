//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //pseudo-global variables
    var attrArray = ["varA", "varB", "varC", "varD", "varE"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

//begin script when window loads
window.onload = setMap();

function setMap() {

    //map frame dimensions
    var width = 960,
        height = 550;

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
        .scale(1050)
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
        csvData = data[0];
        artccsData = data[1];
        conusData = data[2];
        bGCount = data[3];
        cntrPoints = data[4];

        //translate spatial data back to TopoJSON
        var centersTopo = topojson.feature(artccsData, artccsData.objects.ARTCCs).features,
            statesTopo = topojson.feature(conusData, conusData.objects.CONUS),
            backCount = topojson.feature(bGCount, bGCount.objects.BackgroundCountries),
            pointsTopo = topojson.feature(cntrPoints, cntrPoints.objects.points);

                //variables for data join
    var attrArray = ["paxTotal", "cargoWt", "paxMiles", "delay", "canx"];

        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.IDENT; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<centersTopo.length; a++){
    
                var geojsonProps = centersTopo[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.IDENT; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){
    
                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };



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

        //add ARTCC Centers to map
        var center = map.selectAll(".centers")
            .data(centersTopo)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "centers " + d.properties.artcc;
            })
            .attr("d", path);

        //add States overlay to map
        var states = map.append("path")
            .datum(statesTopo)
            .attr("class", "states")
            .attr("d", path);

        //add city points overlay to map
        var points = map.append("path")
            .datum(pointsTopo)
            .attr("class", "points")
            .attr("d", path);

    };

};

})(); //last line of main.js
