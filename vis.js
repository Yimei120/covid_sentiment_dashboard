// Start by loading the map data and the state statistics.  When those are done, call the "ready" function.


Promise.all([

    d3.json("us-states.json"),
    d3.csv("sentiment_tweets.csv"),
    d3.csv("covid.csv")
])
.then(ready);

//variable that decide the state to show in linechart, california by default
let map_state='Florida';
//colormap for sentiments of usmap
let colormap = d3.scaleLinear().domain([-1,0,1]).range(["#4F6457", "#eeeeee", "#D9B44A"]);
//input variable of timeslide, 2020.2.1 by default
let inputValue = '2020-05-01';


// The callback which renders the page after the data has been loaded.
function ready(data) {
    //initialize the usmap
    render(data, "#mapsvg", [-1,0,1], "polarity", '2020-05-01');
    //update the map using time slider
    d3.select("#timeslide").on("input", function() {
        update(data, +this.value);
    });

}

function update(stats, value) {

    let tweets = stats[1];
    var date = getDate(tweets)
    //show the date under the timeslide
    document.getElementById("range").innerHTML= '&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp'+date[value];
    inputValue = date[value];
    //update usmap
    render(stats, "#mapsvg", [-1,0,1], "polarity");
    //update linechart
    lineChart(stats,map_state);
    document.getElementById("state").innerHTML= map_state;
}



// Helper function which, given the entire stats data structure, extracts the requested rate for the requested state

//get dates as an array
function getDate(stats){

    var date = []
    for (var i=0; i< stats.length; i++){
        date.push(stats[i]['time'])
    }
    return(date);

}



// Renders a map within the DOM element specified by svg_id.
function render(data, svg_id, val_range, rate_type) {
    let us = data[0];
    let stats = data[1];
    //generate a dictionary which contains sentiments of states on date of timeslide
    var dict = {};
    for (var i=0; i<stats.length; i++) {
        if (stats[i].time == inputValue){
            dict[stats[i].place.toLowerCase()]=stats[i][rate_type]
        }
    }

    let projection = d3.geoAlbersUsa()
        .translate([600 / 2, 425 / 2]) // translate to center of screen
        .scale([800]); // scale things down so see entire US

    // Define path generator
    let path = d3.geoPath().projection(projection);

    let svg = d3.select(svg_id).attr("width", window.innerWidth*0.6)
        .attr("height", window.innerWidth*0.6);

    var colorLegend = d3.legendColor()
        .shapeWidth(30)
        .orient('horizontal')
        .scale(colormap)
        .cells([-1,-0.5,0,0.5,1])
        .labels(['negative','','','','positive'])
        .shapePadding(5)
        .shapeWidth(50)
        .shapeHeight(20)
        .labelOffset(5);

    svg.append("g")
        .attr("class", "legendLinear")
        .attr("transform", "translate(5, -10)");


    svg.select(".legendLinear")
        .call(colorLegend);

    //usmap
    svg.append("g")
        .attr("class", "states")
        .selectAll("path")
        .data(us.features)
        .enter().append("path")
        .attr("fill", function(d) {

            let rate=dict[d.properties.name.toLowerCase()];//get polarity from dict

            if (!rate){
                return "#e6f2ff";

            }
            return colormap(rate);
        })
        .attr("d", path)
        .on('mouseover', function(d){
            let rate = dict[d.properties.name.toLowerCase()];//get polarity from dict
            //show the polarity as text under usmap
            var decimal = d3.format(",.2f");
            document.getElementById('sentiment_text').innerHTML = 'The sentiment score of ' + d.properties.name + ' is '+ decimal(rate)+ '.';
        })
        .on('click.chart', function(d){
            //show the linechart when click the state
            lineChart(data,d.properties.name);
        })

}

// line chart

//get the number of cases of COVID
function getCases(data,clickedState){
    let covid = data[2]
    var cases = []
    for (var i=0; i < covid.length; i++){
        if (covid[i]['State'].toLowerCase() == clickedState.toLowerCase()){
            cases.push(+covid[i]['Confirmed'])
        }
    }
    return cases;
}

//get date of cases
function getCovidDate(data,clickedState){
    let covid = data[2]
    var date = []
    for (var i=0; i< covid.length; i++){
        if (covid[i]['State'].toLowerCase() == clickedState.toLowerCase()){
            date.push(covid[i]['Last_Update'])
        }
    }
    console.log(date)
    return date;
}



function lineChart(data,state){

    map_state=state;
    //size of linechart
    var margin = {top: 100, right: 50, bottom: 50, left: 50}
    var width = window.innerWidth*0.55 - margin.left - margin.right
    var height = window.innerHeight*0.7 - margin.top - margin.bottom;

    var svg = d3.select("#linechart").append("svg").attr('id','cases')
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //scale of x y axis
    var xScale = d3.scaleTime()
        .domain(d3.extent(getCovidDate(data,state), function(d){return new Date(d)}))
        .range([0, width]);
    var yScale = d3.scaleLinear()
        .domain(d3.extent(getCases(data,state), function(d){return +d}))
        .range([height, 0]);

    var line = d3.line()
        .x(function(d) { return xScale(new Date(d[0])); }) // set the x values for the line generator
        .y(function(d) { return yScale(+d[1]); }) // set the y values for the line generator
        .curve(d3.curveMonotoneX) // apply smoothing to the line

    //generate the plot
    var dataset = d3.zip(getCovidDate(data,state),getCases(data,state))

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale)); // Create an axis component with d3.axisBottom

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(yScale)); // Create an axis component with d3.axisLeft

    //tips when mouseover
    var tips = d3.tip()
        .attr('class','d3-tip')
        .offset([-8, 0])
        .html(function(d){
            let html = "<table>"
                + "<td>"+d[1]+"</td></tr>"
                + "</table>";
            return html;
        })

    svg.call(tips)

    svg.append("path")
        .datum(dataset) // 10. Binds data to the line
        .attr("class", "line") // Assign a class for styling
        .attr("d", line)  // 11. Calls the line generator
        .style('fill-opacity', 0)
        .style('stroke','cadetblue')
        .on('mouseover', function (d, i) {
            d3.select(this).transition()
                .duration('50')
                .attr('opacity', '.55')})
        .on('mouseout', function (d, i) {
            d3.select(this).transition()
                .duration('50')
                .attr('opacity', '1')});

    svg.selectAll(".dot")
        .data(dataset)
        .enter().append("circle") // Uses the enter().append() method
        .attr("class", "dot") // Assign a class for styling
        .attr("cx", function(d) { return xScale(new Date(d[0])) })
        .attr("cy", function(d) {  return yScale(+d[1]) }) //console.log(yScale(d[1]));
        .attr("r", 3)
        .style("fill",'cadetblue')
        .on('mouseover', function (d, i) {
            d3.select(this).transition()
                .duration('50')
                .attr('opacity', '.55')

        })
        .on('mouseout', function (d, i) {
                d3.select(this).transition()
                    .duration('50')
                    .attr('opacity', '1')
        })
        .on('mouseover', tips.show)
        .on('mouseout', tips.hide);

    svg.append("line")
        .attr("x1", xScale(new Date(inputValue)))
        .attr("y1", 0)
        .attr("x2", xScale(new Date(inputValue)))
        .attr("y2", height)
        .style("stroke-width", 2)
        .style("stroke", "#BA5536")
        .style("fill", "none");

        d3.select('#cases').remove()
}





