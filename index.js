var json_viewer = null;
var selected_param = null;
class GlobalState {
    constructor() {
        this.max_global_id = 0;
        this.global_id_holes = new Set([]);
    }
    removeId(id) {
        id = id.slice("global_state_".length);
        this.global_id_holes.add(id);
    }
    getFreshId() {
        if (this.global_id_holes.size > 0) {
            var id = this.global_id_holes.values().next().value;
            this.global_id_holes.delete(id);
        } else {
            var id = this.max_global_id;
            this.max_global_id += 1;
        }
        return "global_state_"+id;
    }
}
var global_state = new GlobalState();

$(document).ready(function(){
    onLoad();
});

function onLoad() {
}

// taken from https://stackoverflow.com/questions/36127648/uploading-a-json-file-and-using-it
function onChangeFile() {
    console.log("loading uploaded json")
    var files = document.getElementById('file').files;
    console.log(files);
    if (files.length <= 0) {
        return false;
    }

    var fr = new FileReader();

    fr.onload = function(e) {
      console.log(e);
      var title = files.item(0)["name"];
      showJSON(e.target.result, title);
    }

    fr.readAsText(files.item(0));
}

function showJSON(json_string, title="Default JSON") {
    json = JSON.parse(json_string);
    d3.select("#title").html(title);
    d3.select("#param-editor").html("");
    if (json == null) {
    } else if (typeof json == "number") {
    } else if (typeof json == "string") {
    } else if (typeof json == "boolean") {
    } else if (Array.isArray(json)) {
    } else {
        json_viewer = new JSONDictionary(json);
        json_viewer.display(d3.select("#param-editor"));
    }
}

class JSONViewer {
    constructor(json, parent=null, name="top") {
        this.json = json;
        this.parent = parent;
        this.name = name;
        this.parent_div = null; // set when display is called
        this.container = null; // set when display is called
        this.recurse();
    }
    recurse() {
    }
    display(parent_div) {
        this.parent_div = parent_div.html("");
    }
    rename(newname) {
        this.name = newname;
    }
    prefix() {
        var prefix = [this.name];
        if (this.parent != null) {
            prefix = this.parent.prefix().concat(prefix);
        }
        return prefix;
    }
    getJSONs() {
    }
}

class JSONNonLeaf extends JSONViewer {
    isTable(checkleaf=false){
        var rows = Object.keys(this.viewers);
        if (rows.length <= 0) {
            return false;
        }
        var example_value = this.viewers[rows[0]];
        // for now, lists are off-limits for being involved in grid viewers
        if ((example_value instanceof Param) || (example_value instanceof JSONList)) {
            return false;
        }
        var columns = Object.keys(example_value.viewers);
        var columns_set = new Set(columns);
        for (var i = 0; i < rows.length; i++) {
            var row_obj = this.viewers[rows[i]];
            if (row_obj instanceof Param) {
                return false;
            }
            var row_columns = Object.keys(row_obj.viewers);
            if (row_columns.length != columns.length) {
                return false;
            }
            for (var j = 0; j < row_columns.length; j++) {
                if (!columns_set.has(row_columns[j])) {
                    return false;
                }
                if (checkleaf && !(this.viewers[rows[i]].viewers[row_columns[j]] instanceof Param)) {
                    return false;
                }
            }
        }
        return true;
    }
    display(parent_div){
        super.display(parent_div);
        this.container = this.parent_div.append("div").attr("class", "border m-3");
        if (this.isTable(true)) {
            this.showTableView();
        } else {
            this.showTabView();
        }
    }
}

// TODO: Fully implement this class, for not it has limited functionality
class JSONList extends JSONNonLeaf {
    recurse() {
        var temp_this = this;
        this.viewers = {}; // stores all sub views
        this.elements = {}; // stores any elements that need to be referenced
        for(var k = 0; k < this.json.length; k++) {
            var v = temp_this.json[k];
            if (v == null) {
                temp_this.viewers[k] = null;
            } else if (typeof v == "number") {
                temp_this.json[k] = {"param": v};
                temp_this.viewers[k] = new NumberParam(temp_this.json[k], temp_this, k);
            } else if (typeof v == "string") {
                temp_this.json[k] = {"param": v};
                temp_this.viewers[k] = new StringParam(temp_this.json[k], temp_this, k);
            } else if (typeof v == "boolean") {
                temp_this.json[k] = {"param": v};
                temp_this.viewers[k] = new BooleanParam(temp_this.json[k], temp_this, k);
            } else if (Array.isArray(v)) {
                temp_this.viewers[k] = new JSONList(v, temp_this, k);
            } else {
                temp_this.viewers[k] = new JSONDictionary(v, temp_this, k);
            }
        }
    }
    isTable(checkleaf=false){
        return false;
    }
    showTabView() {
        var temp_this = this;
        this.tabview = true;
        var views_div = this.container
          .append("div")
        var row = views_div
          .append("table")
          .attr("class", "table")
          .append("tbody")
          .selectAll("tr")
          .data(Object.keys(this.viewers))
          .enter()
            .append("tr");
        row
          .append("td")
          .attr("class", "cell")
          .each(function(d){ temp_this.viewers[d].display(d3.select(this)); });
        row
          .append("td")
          .append("button")
          .style("float", "right")
          .attr("type", "button")
          .attr("class", "btn btn-danger")
          .html("-")
          .attr("index", function(d){ return d; })
          .on("click", function(){
              temp_this.deleteView(Number(d3.select(this).attr("index")));
          });
        var button_group = this.container
          .append("div")
          .attr("class", "btn-group");
        button_group
          .append("button")
          .attr("type", "button")
          .attr("class", "btn btn-light dropdown-toggle")
          .attr("data-toggle", "dropdown")
          .attr("aria-haspopup", "true")
          .attr("areia-expanded", "false")
          .html("+");
        var dropdown_menu = button_group
          .append("div")
          .attr("class", "dropdown-menu");
        dropdown_menu
          .append("a")
          .attr("class", "dropdown-item")
          .attr("href", "#")
          .html("string")
          .on("click", function(){
              temp_this.addView("string");
          });
        dropdown_menu
          .append("a")
          .attr("class", "dropdown-item")
          .attr("href", "#")
          .html("number")
          .on("click", function(){
              temp_this.addView("number");
          });
        dropdown_menu
          .append("a")
          .attr("class", "dropdown-item")
          .attr("href", "#")
          .html("boolean")
          .on("click", function(){
              temp_this.addView("boolean");
          });
    }
    addView(type) {
        var k = this.json.length;
        if (type == "string") {
            this.json.push({"param": "placeholder"});
            this.viewers[k] = new StringParam(this.json[k], this, k);
        } else if (type == "number") {
            this.json.push({"param": 0});
            this.viewers[k] = new NumberParam(this.json[k], this, k);
        } else if (type == "boolean") {
            this.json.push({"param": false});
            this.viewers[k] = new BooleanParam(this.json[k], this, k);
        }
        this.display(this.parent_div);
    }
    deleteView(index) {
        // d3.select(this.viewers[index].parent_div.node().parentNode).remove();
        for(var i = index+1; i < Object.keys(this.viewers).length; i++) {
            this.json[index] = this.json[index+1];
            this.viewers[index] = this.viewers[index+1];
        }
        this.json.pop();
        delete this.viewers[Object.keys(this.viewers).length-1];
        this.display(this.parent_div);
    }
    getJSONs() {
        var temp_this = this;
        var return_jsons = [[]];
        for(var k = 0; k < this.json.length; k++) {
            var jsons = temp_this.viewers[k].getJSONs();
            var return_jsons_list = [];
            for (var i = 0; i < jsons.length; i++) {
                var return_jsons_copy = JSON.parse(JSON.stringify(return_jsons));
                return_jsons_copy.forEach(function(e){
                    e.push(jsons[i]);
                });
                return_jsons_list.push(return_jsons_copy);
            }
            return_jsons = [].concat(...return_jsons_list);
        }
        return return_jsons;
    }
}

class JSONDictionary extends JSONNonLeaf {
    recurse() {
        var temp_this = this;
        this.viewers = {}; // stores all sub views
        this.elements = {}; // stores any elements that need to be referenced
        Object.keys(this.json).forEach(function(k){
            var v = temp_this.json[k];
            if (v == null) {
                temp_this.viewers[k] = null;
            } else if (typeof v == "number") {
                temp_this.json[k] = {"param": v};
                temp_this.viewers[k] = new NumberParam(temp_this.json[k], temp_this, k);
            } else if (typeof v == "string") {
                temp_this.json[k] = {"param": v};
                temp_this.viewers[k] = new StringParam(temp_this.json[k], temp_this, k);
            } else if (typeof v == "boolean") {
                temp_this.json[k] = {"param": v};
                temp_this.viewers[k] = new BooleanParam(temp_this.json[k], temp_this, k);
            } else if (Array.isArray(v)) {
                temp_this.viewers[k] = new JSONList(v, temp_this, k);
            } else {
                temp_this.viewers[k] = new JSONDictionary(v, temp_this, k);
            }
        });
    }
    showTabView(){
        var temp_this = this;
        this.tabview = true;
        if (this.isTable()) {
            this.container
              .html("")
              .append("button")
              .attr("class", "btn btn-primary")
              .attr("type", "submit")
              .html("Table View")
              .on("click", function(){ temp_this.showTableView(); });
        }
        var row = this.container
          .append("table")
          .attr("class", "table table-bordered")
          .append("tbody")
          .selectAll("tr")
          .data(Object.keys(this.viewers).filter(function(e){ return temp_this.viewers[e] instanceof Param; }))
          .enter()
            .append("tr")
        row
          .append("th")
          .attr("scope", "row")
          .html(function(d){ return d; });
        row
          .append("td")
          .attr("class", "cell")
          .each(function(d){ temp_this.viewers[d].display(d3.select(this)); });

        var tabs = Object.keys(this.viewers).filter(function(e){ return temp_this.viewers[e] instanceof JSONNonLeaf; });
        var ids = {};
        tabs.forEach(function(t){
            ids[t] = [global_state.getFreshId(), global_state.getFreshId()];
        });

        var tabitems = this.container
          .append("ul")
          .attr("class", "nav nav-tabs")
          .selectAll("li")
          .data(tabs)
          .enter()
            .append("li")
            .attr("id", function(d){ return ids[d][0]; })
            .attr("class", "nav-item")
            .each(function(d){ temp_this.elements[d+"_tab"] = this; })
            .append("a")
            .attr("class", "nav-link")
            .attr("data-toggle", "tab")
            .attr("href", function(d){ return "#"+ids[d][1]; })
            .html(function(d){ return d; });

        var tab_content_wrapper = this.container
          .append("div")
          .attr("class", "tab-content")
          .selectAll("div")
          .data(tabs)
          .enter()
            .append("div")
            .attr("id", function(d){ return ids[d][1]; })
            .attr("class", "tab-pane fade")
            .each(function(d){ temp_this.viewers[d].display(d3.select(this)); });

        this.container
          .select(".nav")
          .selectAll(".nav-item")
          .select("a")
          .on("dblclick", function(){ temp_this.editKeyName(d3.select(this).html()); });
    }
    showTableView() {
        this.tabview = false;
        var temp_this = this;
        this.container
          .html("")
          .append("button")
          .attr("class", "btn btn-primary")
          .attr("type", "submit")
          .html("Tab View")
          .on("click", function(){ temp_this.showTabView(); });
        var table = this.container
          .append("table")
          .attr("class", "table table-bordered");
        var column_names = Object.keys(Object.values(this.viewers)[0].viewers);

        table
          .append("thead")
          .append("tr")
          .selectAll("th")
          .data([""].concat(column_names))
          .enter()
            .append("th")
            .attr("scope", "col")
            .html(function(d){ return d; });
        Object.keys(this.viewers).forEach(function(e1){
            var row = table
              .append("tbody")
              .append("tr");
            row
              .append("th")
              .attr("scope", "row")
              .html(e1);
            Object.keys(temp_this.viewers[e1].viewers).forEach(function(e2){
                var cell = row.append("td").attr("class", "cell");
                temp_this.viewers[e1].viewers[e2].display(cell);
            });
        });
    }
    editKeyName(key) {
        var temp_this = this;
        if (this.tabview && (key in this.viewers) && (this.viewers[key] instanceof JSONNonLeaf)) {
            var tab = d3.select(this.elements[key+"_tab"]);
            tab.select("a").classed("hide", true);
            var input = tab
              .append("input")
              .attr("class", "form-control")
              .attr("value", key);
            input.node().select();
            $(input.node()).on("click", function(){ return false; });
            $(document).on("click.forChangeKeyName", function(){
                temp_this.changeKeyName(key, input.node().value);
                $(document).off("click.forChangeKeyName");
            });
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input.node().addEventListener("keyup", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    temp_this.changeKeyName(key, input.node().value);
                }
            });
        } else { // may not need any other cases
        }
    }
    changeKeyName(key, newname){
        var temp_this = this;
        newname = newname.trim();
        if (this.tabview && (key in this.viewers) && (this.viewers[key] instanceof JSONNonLeaf)) {
            var tab = d3.select(this.elements[key+"_tab"]);
            tab.select("input").remove();
            var a = tab.select("a");
            console.log(key);
            console.log(newname);
            a.classed("hide", false);
            if (newname == "" || key == newname) { return; }
            a.html(newname);

            //bookkeeping
            changeKey(this.json, key, newname);
            changeKey(this.viewers, key, newname);
            this.viewers[newname].rename(newname);
        } else { // may not need any other cases
        }
    }
    getJSONs() {
        var temp_this = this;
        var return_jsons = [{}];
        Object.keys(this.viewers).forEach(function(k){
            var jsons = temp_this.viewers[k].getJSONs();
            var return_jsons_list = [];
            for (var i = 0; i < jsons.length; i++) {
                var return_jsons_copy = JSON.parse(JSON.stringify(return_jsons));
                return_jsons_copy.forEach(function(e){
                    e[k] = jsons[i];
                });
                return_jsons_list.push(return_jsons_copy);
            }
            return_jsons = [].concat(...return_jsons_list);
        });
        return return_jsons;
    }
}

// a json leaf
class Param extends JSONViewer {
    getJSONs() {
        return [this.json["param"]];
    }
}

class StringParam extends Param {
    constructor(json, parent=null, name="top") {
        super(json, parent, name);
        this.json["type"] = "string";
        this.global_identifier = global_state.getFreshId();
        this.content = null;
    }
    display(parent_div) {
        super.display(parent_div);
        var temp_this = this;
        this.parent_div
          .attr("tabindex", "0")
          .attr("data-trigger", "manual")
          .attr("data-container", "body")
          .attr("data-toggle", "popover")
          .attr("data-placement", "top")
          .attr("data-html", "true")
          .html(this.json["param"]);
        this.turnOnSelectListeners();
    }
    deselect() {
        this.turnOffDeselectListeners();
        // save
        this.savePopoverInfo();
        // destroy
        console.log("deselecting");
        this.parent_div.classed("selected", false);
        $(this.parent_div.node()).popover('dispose');
        this.content.remove();
        this.turnOnSelectListeners();
    }
    select() {
        this.turnOffSelectListeners();
        // open popover
        console.log("selecting cell");
        this.parent_div.classed("selected", true);
        this.setPopoverContent();
        $(this.parent_div.node()).popover({"content":this.content.node()});
        $(this.parent_div.node()).popover('show');
        this.turnOnDeselectListeners();
    }
    turnOnSelectListeners() {
        var temp_this = this;
        $(this.parent_div.node()).on("click.selectParam"+this.global_identifier, function(){ temp_this.select(); });
        $(this.parent_div.node()).on("keypress.selectParam"+this.global_identifier, function(e){
            if(e.which == 13) {
                temp_this.select();
            }
        });
    }
    turnOffSelectListeners() {
        $(this.parent_div.node()).off("click.selectParam"+this.global_identifier);
        $(this.parent_div.node()).off("keypress.selectParam"+this.global_identifier);
    }
    turnOnDeselectListeners() {
        var temp_this = this;
        $(this.content.node()).on("click.deselectParam"+this.global_identifier, function(e){ console.log("click on popover"); e.stopPropagation(); });
        $(document).on("click.deselectParam"+this.global_identifier, function(e){
            console.log("first click on document");
            $(document).off("click.deselectParam"+temp_this.global_identifier); // ignore the first one;
            $(document).on("click.deselectParam"+temp_this.global_identifier, function(e){
                console.log("second click on document");
                temp_this.deselect();
            });
        });
    }
    turnOffDeselectListeners() {
        // $(this.content.node()).off("focusin.deselectParam"+this.global_identifier);
        $(this.content.node()).off("click.deselectParam"+this.global_identifier);
        // $(document).off("focusin.deselectParam"+this.global_identifier);
        $(document).off("click.deselectParam"+this.global_identifier);
    }
    setPopoverContent() {
        var temp_this = this;
        this.content = d3.select(d3.select("#cell-popover-template-wrapper").select("div").node().cloneNode(true));
        var input = this.content.append("input")
          .attr("class", "form-control")
          .attr("value", this.json["param"]);
        $(this.parent_div.node()).on("shown.bs.popover", function(){
            input.node().select();
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    temp_this.deselect();
                    $(temp_this.parent_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    temp_this.deselect();
                    $(temp_this.parent_div.node()).focus();
                }
            });
        });
    }
    // directions: 0 - right, 1 - down, 2 - left, 3 - up
    // TODO: implement this
    getNextParam(direction=0) {
        if (direction == 0) {
        }
    }
    savePopoverInfo() {
        var value = this.content.select("input").node().value.trim();
        if (value != "") {
            this.json["param"] = value;
            this.parent_div.html(value);
        }
    }
}

class NumberParam extends StringParam {
    constructor(json, parent=null, name="top") {
        super(json, parent, name);
        this.json["type"] = "number";
        this.json["param"] = {"number": this.json["param"]};
        this.object = new NumberObject(this.json["param"]);
        this.options = {"number":NumberObject, "range":RangeObject, "normal dist": NormalDistObject};
    }
    display(parent_div) {
        super.display(parent_div);
        this.object.display(parent_div);
    }
    setPopoverContent() {
        var temp_this = this;
        this.content = d3.select(d3.select("#cell-popover-template-wrapper").select("div").node().cloneNode(true));
        var select = this.content.append("select")
        select.selectAll("option").data(Object.keys(this.options)).enter().append("option")
            .attr("value", function(d){ return d; })
            .html(function(d){ return d; });
        select.node().value = this.object.getName();
        this.content.append("div");
        this.populatePopoverInput();
        select.on("change", function(){ temp_this.populatePopoverInput(true); });
    }
    populatePopoverInput(popover_initialized=false) {
        var temp_this = this;
        var type = this.content.select("select").node().value;
        if (this.object.getName() != type) {
            this.object.savePopoverInfo();
            this.object = new this.options[type](this.object.json); // cast to a new object
            this.object.display(this.parent_div)
        }
        this.object.populatePopoverInput(this.content.select("div"), this);
        if (popover_initialized) {
            $(this.parent_div.node()).popover('show');
        }
    }
    savePopoverInfo() {
        this.object.savePopoverInfo();
        this.object.display(this.parent_div);
    }
    getJSONs() {
        return this.object.getJSONs();
    }
}

class BooleanParam extends Param {
    display(parent_div) {
        var temp_this = this;
        var checkdiv = parent_div.append("div")
          .attr("class", "form-check");
        var checkbox_id = global_state.getFreshId();
        var checkbox_label_id = global_state.getFreshId();
        var checkbox = checkdiv
          .append("input")
          .attr("class", "form-check-input")
          .attr("type", "checkbox")
          .attr("value", this.json["param"])
          .attr("id", checkbox_id)
          .on("click", function(){
              temp_this.json["param"] = !temp_this.json["param"];
              d3.select("#"+checkbox_label_id).html(temp_this.json["param"]);
              d3.select(this).attr("value", temp_this.json["param"]);
          });
        checkbox.node().checked = this.json["param"];
        checkdiv
          .append("label")
          .attr("class", "form-check-label")
          .attr("for", checkbox_id)
          .attr("id", checkbox_label_id)
          .html(this.json["param"]);
    }
}


class AbstractParamObject {
    constructor(json) {
        this.json = json;
        this.json["extras"] = {};
        this.cell_div = null;
        this.input_div = null;
    }
    populatePopoverInput(input_div, param) {
        this.input_div = input_div.html("");
    }
    display(cell_div) {
        this.cell_div = cell_div.html("");
    }
}

class AbstractNumberObject extends AbstractParamObject {
}


class NumberObject extends AbstractNumberObject {
    getName() {
        return "number";
    }
    populatePopoverInput(input_div, param) {
        super.populatePopoverInput(input_div);
        var temp_this = this;
        var input = this.input_div
          .append("input")
          .attr("class", "form-control")
          .attr("value", this.json["number"]);
        $(this.cell_div.node()).on("shown.bs.popover", function(){
            input.node().select();
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
        });
    }
    display(cell_div) {
        super.display(cell_div);
        this.cell_div.html(this.json["number"]);
    }
    savePopoverInfo() {
        this.json["number"] = Number(this.input_div.select("input").node().value.trim());
    }
    getJSONs() {
        return [this.json["number"]];
    }
}

class RangeObject extends AbstractNumberObject {
    constructor(json) {
        super(json);
        this.json["extras"]["lower"] = json["number"];
        this.json["extras"]["upper"] = json["number"]+1;
        this.json["extras"]["by"] = 1;
        this.input1 = null;
        this.input2 = null;
        this.input3 = null;
    }
    getName() {
        return "range";
    }
    populatePopoverInput(input_div, param) {
        var temp_this = this;
        super.populatePopoverInput(input_div);
        this.input1 = this.input_div
          .append("input")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["lower"]);
        this.input_div
          .append("text")
          .attr("class", "inline")
          .html("to");
        this.input2 = this.input_div
          .append("input")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["upper"]);
        this.input_div
          .append("text")
          .attr("class", "inline")
          .html("by");
        this.input3 = this.input_div
          .append("input")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["by"]);

        $(this.cell_div.node()).on("shown.bs.popover", function(){
            temp_this.input1.node().select();
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            temp_this.input1.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
            temp_this.input2.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
            temp_this.input3.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
        });
    }
    display(cell_div) {
        super.display(cell_div);
        this.cell_div.html("Range: "+this.json["extras"]["lower"]+" to "+this.json["extras"]["upper"]+" by "+this.json["extras"]["by"]);
    }
    savePopoverInfo() {
        this.json["extras"]["lower"] = Number(this.input1.node().value.trim());
        this.json["extras"]["upper"] = Number(this.input2.node().value.trim());
        this.json["extras"]["by"] = Number(this.input3.node().value.trim());
        this.json["number"] = this.json["extras"]["lower"];
    }
    getJSONs() {
        var return_jsons = [];
        for(var i = this.json["extras"]["lower"]; i <= this.json["extras"]["upper"]; i += this.json["extras"]["by"]) {
            return_jsons.push(i);
        }
        return return_jsons;
    }
}

class NormalDistObject extends AbstractNumberObject {
    constructor(json) {
        super(json);
        this.json["extras"]["mean"] = json["number"];
        this.json["extras"]["variance"] = 0;
        this.json["extras"]["num_samples"] = 1;
        this.input1 = null;
        this.input2 = null;
    }
    getName() {
        return "normal dist";
    }
    populatePopoverInput(input_div, param) {
        var temp_this = this;
        super.populatePopoverInput(input_div);
        this.input_div
          .append("text")
          .attr("class", "inline")
          .html("Mean:");
        this.input1 = this.input_div
          .append("input")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["mean"]);
        this.input_div
          .append("text")
          .attr("class", "inline")
          .html("Variance:");
        this.input2 = this.input_div
          .append("input")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["variance"]);
        this.input_div
          .append("text")
          .attr("class", "inline")
          .html("Number of Samples:");
        this.input3 = this.input_div
          .append("input")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["num_samples"]);
        $(this.cell_div.node()).on("shown.bs.popover", function(){
            temp_this.input1.node().select();
            // taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            temp_this.input1.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
            temp_this.input2.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
            temp_this.input3.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    param.deselect();
                    $(temp_this.cell_div.node()).focus();
                }
            });
        });
    }
    display(cell_div) {
        super.display(cell_div);
        this.cell_div.html("NormalDist("+this.json["extras"]["mean"]+", "+this.json["extras"]["variance"]+")");
    }
    savePopoverInfo() {
        this.json["extras"]["mean"] = Number(this.input1.node().value.trim());
        this.json["extras"]["variance"] = Number(this.input2.node().value.trim());
        this.json["extras"]["num_samples"] = Number(this.input3.node().value.trim());
        this.json["number"] = this.json["extras"]["mean"];
    }
    getJSONs() {
        var return_jsons = [];
        for(var i = 0; i < this.json["extras"]["num_samples"]; i++) {
            return_jsons.push(randn_bm());
        }
        return return_jsons;
    }
}

function changeKey(dictionary, originalname, newname){
    dictionary[newname] = dictionary[originalname];
    delete dictionary[originalname];
}

function getViewerNode(prefix){
    prefix = prefix.slice(1);
    var curr = json_viewer;
    for (var i = 0; i < prefix.length; i++) {
        curr = curr.viewers[prefix[i]];
    }
    return curr;
}


// taken from https://ourcodeworld.com/articles/read/189/how-to-create-a-file-and-generate-a-download-with-javascript-in-the-browser-without-a-server
function downloads() {
    let zip = new JSZip();
    var jsons = json_viewer.getJSONs();
    for (var i = 0; i < jsons.length; i++) {
        zip.file('microsimulation_paramemters'+i+'.json', JSON.stringify(jsons[i], undefined, 2));
    }
    zip.generateAsync({type: "blob"}).then(function(content) {
        saveAs(content, 'microsimulation_paramemters.zip');
    });

    // let zip = new JSZip();
    // zip.file("idlist.txt", `PMID:29651880\r\nPMID:29303721`);
    // zip.generateAsync({type: "blob"}).then(function(content) {
    //   saveAs(content, "download.zip");
    // });

    // var zip = new JSZip();
    // zip.file("Hello.txt", "Hello World\n");
    // // var img = zip.folder("images");
    // // img.file("smile.gif", imgData, {base64: true});
    // zip.generateAsync({type:"blob"})
    // .then(function(content) {
    //     // see FileSaver.js
    //     saveAs(content, "example.zip");
    // });

    // var blob = new Blob(["Hello, world!"], {type: "text/plain;charset=utf-8"});
    // saveAs(blob, "hello world.txt");

    // var element = document.createElement('a');
    // element.style.display = 'none';
    // var text = 'hello world';
    // element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    // element.setAttribute('download', 'microsimulation_paramemters.json');
    // document.body.appendChild(element);
    // element.click();
    // document.body.removeChild(element);
}

// taken from https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve/36481059#36481059
// Standard Normal variate using Box-Muller transform.
function randn_bm() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

