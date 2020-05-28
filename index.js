var json_viewer = null;
var editing_param = null;
var modal_chosen_param = null;
var dependent_params = new Set([]);
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
    if (files.length <= 0) {
        return false;
    }

    var fr = new FileReader();

    fr.onload = function(e) {
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
        json_viewer.display("primary", d3.select("#param-editor"), "primary");
        json_viewer.display("modal", d3.select("#chooseParamModal").select(".modal-body"), "select_param");
    }
}

class JSONViewer {
    constructor(json, parent=null, name="top") {
        this.json = json;
        this.parent = parent;
        this.name = name;
        this.displays = {};
        this.recurse();
    }
    recurse() {
    }
    newDisplay(name, parent_div, mode) {
       return new Display(this, name, parent_div, mode);
    }
    display(name, parent_div, mode="primary") {
        if (name in this.displays) {
            this.removeDisplay(name);
        }
        this.displays[name] = this.newDisplay(name, parent_div, mode);
    }
    refreshDisplays() {
        Object.values(this.displays).forEach(function(d){ d.populateDisplay(); });
    }
    removeDisplay(name){
        this.displays[name].remove();
        delete this.displays[name];
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

class Display {
    constructor(viewer, name, parent_div, mode) {
        this.viewer = viewer;
        this.name = name;
        this.parent_div = parent_div;
        this.mode = mode;
        this.populateDisplay();
    }
    populateDisplay() {
        this.remove();
    }
    remove() {
        this.parent_div.html("");
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
    newDisplay(name, parent_div, mode) {
       return new DisplayNonLeaf(this, name, parent_div, mode);
    }
}

class DisplayNonLeaf extends Display {
    populateDisplay() {
        super.populateDisplay();
        this.elements = {}; // stores any elements that need to be referenced
        this.container = this.parent_div.append("div").attr("class", "border m-3");
        if (this.viewer.isTable(true)) {
            this.showTableView();
        } else {
            this.showTabView();
        }
    }
    showTabView() { // implemented in subclass
    }
    showTableView() { // implemented in subclass
    }
}

// TODO: Fully implement this class, for not it has limited functionality
class JSONList extends JSONNonLeaf {
    recurse() {
        var temp_this = this;
        this.viewers = {}; // stores all sub views
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
                if (isNumberParam(v)) {
                    temp_this.viewers[k] = new NumberParam(v, temp_this, k);
                } else if (isStringParam(v)) {
                    temp_this.viewers[k] = new StringParam(v, temp_this, k);
                } else if (isBooleanParam(v)) {
                    temp_this.viewers[k] = new BooleanParam(v, temp_this, k);
                } else {
                    temp_this.viewers[k] = new JSONDictionary(v, temp_this, k);
                }
            }
        }
    }
    isTable(checkleaf=false){
        return false;
    }
    newDisplay(name, parent_div, mode) {
       return new DisplayList(this, name, parent_div, mode);
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
        this.refreshDisplays();
    }
    deleteView(index) {
        for(var i = index+1; i < Object.keys(this.viewers).length; i++) {
            this.json[i-1] = this.json[i];
            this.viewers[i-1] = this.viewers[i];
            this.viewers[i-1].rename(i);
        }
        this.json.pop();
        delete this.viewers[Object.keys(this.viewers).length-1];
        this.refreshDisplays();
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

class DisplayList extends DisplayNonLeaf {
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
          .data(Object.keys(this.viewer.viewers))
          .enter()
            .append("tr");
        row
          .append("td")
          .attr("class", "cell")
          .each(function(d){ temp_this.viewer.viewers[d].display(temp_this.name, d3.select(this), temp_this.mode); });
        row
          .append("td")
          .append("button")
          .style("float", "right")
          .attr("type", "button")
          .attr("class", "btn btn-danger")
          .html("-")
          .attr("index", function(d){ return d; })
          .on("click", function(){
              temp_this.viewer.deleteView(Number(d3.select(this).attr("index")));
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
              temp_this.viewer.addView("string");
          });
        dropdown_menu
          .append("a")
          .attr("class", "dropdown-item")
          .attr("href", "#")
          .html("number")
          .on("click", function(){
              temp_this.viewer.addView("number");
          });
        dropdown_menu
          .append("a")
          .attr("class", "dropdown-item")
          .attr("href", "#")
          .html("boolean")
          .on("click", function(){
              temp_this.viewer.addView("boolean");
          });
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
                if (isNumberParam(v)) {
                    temp_this.viewers[k] = new NumberParam(v, temp_this, k);
                } else if (isStringParam(v)) {
                    temp_this.viewers[k] = new StringParam(v, temp_this, k);
                } else if (isBooleanParam(v)) {
                    temp_this.viewers[k] = new BooleanParam(v, temp_this, k);
                } else {
                    temp_this.viewers[k] = new JSONDictionary(v, temp_this, k);
                }
            }
        });
    }
    newDisplay(name, parent_div, mode) {
       return new DisplayDictionary(this, name, parent_div, mode);
    }
    changeKeyName(key, newname){
        var temp_this = this;
        newname = newname.trim();
        if (newname == "" || key == newname) { return; }
        Object.values(this.displays).forEach(function(d){ d.changeKeyName(key, newname); });
        //bookkeeping
        changeKey(this.json, key, newname);
        changeKey(this.viewers, key, newname);
        this.viewers[newname].rename(newname);
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

class DisplayDictionary extends DisplayNonLeaf {
    showTabView(){
        var temp_this = this;
        this.tabview = true;
        if (this.viewer.isTable()) {
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
          .data(Object.keys(this.viewer.viewers).filter(function(e){ return temp_this.viewer.viewers[e] instanceof Param; }))
          .enter()
            .append("tr")
        row
          .append("th")
          .attr("scope", "row")
          .html(function(d){ return d; });
        row
          .append("td")
          .attr("class", "cell")
          .each(function(d){ temp_this.viewer.viewers[d].display(temp_this.name, d3.select(this), temp_this.mode); });

        var tabs = Object.keys(this.viewer.viewers).filter(function(e){ return temp_this.viewer.viewers[e] instanceof JSONNonLeaf; });
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
            .each(function(d){ temp_this.viewer.viewers[d].display(temp_this.name, d3.select(this), temp_this.mode); });

        if (this.mode == "primary") {
            this.container
              .select(".nav")
              .selectAll(".nav-item")
              .select("a")
              .on("dblclick", function(){ temp_this.editKeyName(d3.select(this).html()); });
        }
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
        var column_names = Object.keys(Object.values(this.viewer.viewers)[0].viewers);

        table
          .append("thead")
          .append("tr")
          .selectAll("th")
          .data([""].concat(column_names))
          .enter()
            .append("th")
            .attr("scope", "col")
            .html(function(d){ return d; });
        Object.keys(this.viewer.viewers).forEach(function(e1){
            var row = table
              .append("tbody")
              .append("tr");
            row
              .append("th")
              .attr("scope", "row")
              .html(e1);
            Object.keys(temp_this.viewer.viewers[e1].viewers).forEach(function(e2){
                var cell = row.append("td").attr("class", "cell");
                temp_this.viewer.viewers[e1].viewers[e2].display(temp_this.name, cell, temp_this.mode);
            });
        });
    }
    editKeyName(key) {
        var temp_this = this;
        if (this.tabview && (key in this.viewer.viewers) && (this.viewer.viewers[key] instanceof JSONNonLeaf)) {
            var tab = d3.select(this.elements[key+"_tab"]);
            tab.select("a").classed("hide", true);
            var input = tab
              .append("input")
              .attr("class", "form-control")
              .attr("value", key);
            input.node().select();
            $(input.node()).on("click", function(){ return false; });
            $(document).on("click.forChangeKeyName", function(){
                var newname = input.node().value;
                input.node().remove();
                $(document).off("click.forChangeKeyName");
                tab.select("a").classed("hide", false);
                temp_this.viewer.changeKeyName(key, newname);
            });
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input.node().addEventListener("keyup", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    var newname = input.node().value;
                    input.node().remove();
                    $(document).off("click.forChangeKeyName");
                    tab.select("a").classed("hide", false);
                    temp_this.viewer.changeKeyName(key, newname);
                }
            });
        } else { // may not need any other cases
        }
    }
    changeKeyName(key, newname) {
        d3.select(this.elements[key+"_tab"])
          .select("a")
          .classed("hide", false)
          .html(newname);
        changeKey(this.elements, key+"_tab", newname+"_tab");
    }
}

// a json leaf
class Param extends JSONViewer {
    constructor(json, parent=null, name="top") {
        super(json, parent, name);
        this.global_identifier = global_state.getFreshId();
    }
    getJSONs() {
        return [this.json["param"]];
    }
}

class StringParam extends Param {
    constructor(json, parent=null, name="top") {
        super(json, parent, name);
        this.json["type"] = "string";
    }
    newDisplay(name, parent_div, mode) {
       return new DisplayStringParam(this, name, parent_div, mode);
    }
    savePopoverInfo(value) {
        this.json["param"] = value;
        Object.values(this.displays).forEach(function(d){ d.parent_div.html(value); });
    }
}

class DisplayStringParam extends Display {
    populateDisplay() {
        super.populateDisplay();
        var temp_this = this;
        this.parent_div
          .attr("tabindex", "0")
          .attr("data-trigger", "manual")
          .attr("data-container", "body")
          .attr("data-toggle", "popover")
          .attr("data-placement", "top")
          .attr("data-html", "true")
          .html(this.viewer.json["param"]);
        if (this.mode == "primary") {
            this.turnOffSelectListeners();
            this.turnOnSelectListeners();
        }
    }
    deselect(update=true) {
        this.turnOffDeselectListeners();
        // save
        this.savePopoverInfo();
        // destroy
        console.log("deselecting");
        this.parent_div.classed("selected", false);
        $(this.parent_div.node()).popover('dispose');
        this.content.remove();
        if (update) {
            this.viewer.refreshDisplays();
        } else {
            this.turnOnSelectListeners();
        }
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
        $(this.parent_div.node()).on("click.selectParam_"+this.viewer.global_identifier+"_"+this.name, function(){ temp_this.select(); });
        $(this.parent_div.node()).on("keypress.selectParam_"+this.viewer.global_identifier+"_"+this.name, function(e){
            if(e.which == 13) {
                temp_this.select();
            }
        });
    }
    turnOffSelectListeners() {
        $(this.parent_div.node()).off("click.selectParam_"+this.viewer.global_identifier+"_"+this.name);
        $(this.parent_div.node()).off("keypress.selectParam_"+this.viewer.global_identifier+"_"+this.name);
    }
    turnOnDeselectListeners() {
        var temp_this = this;
        $(this.content.node()).on("click.deselectParam_"+this.viewer.global_identifier+"_"+this.name, function(e){ console.log("click on popover"); e.stopPropagation(); });
        $(document).on("click.deselectParam_"+this.viewer.global_identifier+"_"+this.name, function(e){
            console.log("first click on document");
            $(document).off("click.deselectParam_"+temp_this.viewer.global_identifier+"_"+temp_this.name); // ignore the first one;
            $(document).on("click.deselectParam_"+temp_this.viewer.global_identifier+"_"+temp_this.name, function(e){
                console.log("second click on document");
                temp_this.deselect();
            });
        });
    }
    turnOffDeselectListeners() {
        // $(this.content.node()).off("focusin.deselectParam_"+this.viewer.global_identifier+"_"+this.name);
        $(this.content.node()).off("click.deselectParam_"+this.viewer.global_identifier+"_"+this.name);
        // $(document).off("focusin.deselectParam_"+this.viewer.global_identifier+"_"+this.name);
        $(document).off("click.deselectParam_"+this.viewer.global_identifier+"_"+this.name);
    }
    setPopoverContent() {
        var temp_this = this;
        this.content = d3.select(d3.select("#cell-popover-template-wrapper").select("div").node().cloneNode(true));
        var input = this.content.append("input")
          .attr("class", "form-control")
          .attr("value", this.viewer.json["param"]);
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
            this.viewer.savePopoverInfo(value);
        }
    }
}

class NumberParam extends StringParam {
    constructor(json, parent=null, name="top") {
        super(json, parent, name);
        this.options = {"number":NumberObject, "range":RangeObject, "normal dist": NormalDistObject, "identity":IdentityNumberObject};
        this.json["type"] = "number";
        if (typeof this.json["param"] == "number") {
            this.json["param"] = {"number": this.json["param"]};
            this.object = new NumberObject(this.json["param"], this);
        } else {
            this.object = new this.options[this.json["param"]["type"]](this.json["param"], this);
        }
    }
    newDisplay(name, parent_div, mode) {
       return new DisplayNumberParam(this, name, parent_div, mode);
    }
    refreshDisplays(propogate=true) {
        super.refreshDisplays();
        if (propogate) {
            this.object.refreshBackpointers();
        }
    }
    getJSONs() {
        return this.object.getJSONs();
    }
    savePopoverInfo(input_div) {
        this.object.savePopoverInfo(input_div);
    }
}

class DisplayNumberParam extends DisplayStringParam {
    populateDisplay() {
        super.populateDisplay();
        this.viewer.object.display(this.parent_div);
        if (this.mode == "select_param") {
            var temp_this = this;
            this.parent_div
              .classed("param_to_select", true)
              .on("click", function(){ modalSelectParam(temp_this.viewer); });
        }
    }
    setPopoverContent() {
        var temp_this = this;
        this.content = d3.select(d3.select("#cell-popover-template-wrapper").select("div").node().cloneNode(true));
        var select = this.content.append("select");
        select.selectAll("option").data(Object.keys(this.viewer.options)).enter().append("option")
            .attr("value", function(d){ return d; })
            .html(function(d){ return d; });
        select.node().value = this.viewer.object.getName();
        this.content.append("div");
        this.populatePopoverInput();
        select.on("change", function(){ temp_this.populatePopoverInput(true); });
    }
    populatePopoverInput(popover_initialized=false) {
        var temp_this = this;
        var type = this.content.select("select").node().value;
        if (this.viewer.object.getName() != type) {
            this.viewer.object.savePopoverInfo(this.content.select("div"));
            if (this.viewer.object instanceof IdentityNumberObject) {
                this.viewer.object.setParam(null);
            }
            this.viewer.object = new this.viewer.options[type](this.viewer.object.json, this.viewer, this.viewer.object.backpointers); // cast to a new object
        }
        this.viewer.object.populatePopoverInput(this.parent_div, this.content.select("div"), this);
        if (popover_initialized) {
            $(this.parent_div.node()).popover('show');
        }
    }
    savePopoverInfo() {
        this.viewer.savePopoverInfo(this.content.select("div"));
    }
}

class BooleanParam extends Param {
    constructor(json, parent=null, name="top") {
        super(json, parent, name);
        this.json["type"] = "boolean";
    }
    newDisplay(name, parent_div, mode) {
       return new DisplayBooleanParam(this, name, parent_div, mode);
    }
}

class DisplayBooleanParam extends Display {
    populateDisplay() {
        var temp_this = this;
        var checkdiv = this.parent_div.append("div")
          .attr("class", "form-check");
        var checkbox_id = global_state.getFreshId();
        var checkbox_label_id = global_state.getFreshId();
        var checkbox = checkdiv
          .append("input")
          .attr("class", "form-check-input")
          .attr("type", "checkbox")
          .attr("value", this.viewer.json["param"])
          .attr("id", checkbox_id)
          .on("click", function(){
              temp_this.viewer.json["param"] = !temp_this.viewer.json["param"];
              d3.select("#"+checkbox_label_id).html(temp_this.viewer.json["param"]);
              d3.select(this).attr("value", temp_this.viewer.json["param"]);
          });
        checkbox.node().checked = this.viewer.json["param"];
        checkdiv
          .append("label")
          .attr("class", "form-check-label")
          .attr("for", checkbox_id)
          .attr("id", checkbox_label_id)
          .html(this.viewer.json["param"]);
    }
}

class AbstractParamObject {
    constructor(json, param, backpointers=new Set([])) {
        this.json = json;
        this.param = param;
        if (!("extras" in this.json)){
            this.json["extras"] = {};
        }
        this.backpointers = backpointers;
        dependent_params.delete(this.param);
    }
    populatePopoverInput(input_div, param) {
        input_div.html("");
    }
    display(cell_div) {
        cell_div.html(this.toString());
        cell_div.classed("error", false);
    }
    toString() {
        return "Error: abstract param object";
    }
    savePopoverInfo(input_div) {
    }
    refreshBackpointers() {
        Array.from(this.backpointers).forEach(function(param){ param.refreshDisplays(); });
    }
}

class AbstractNumberObject extends AbstractParamObject {
    constructor(json, param, backpointers=new Set([])) {
        super(json, param, backpointers);
        this.json["type"] = this.getName();
    }
    getName() {
        return "abstract";
    }
}

class NumberObject extends AbstractNumberObject {
    getName() {
        return "number";
    }
    populatePopoverInput(cell_div, input_div, display) {
        super.populatePopoverInput(input_div);
        var input = input_div
          .append("input")
          .attr("class", "form-control")
          .attr("value", this.json["number"]);
        $(cell_div.node()).on("shown.bs.popover", function(){
            input.node().select();
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
        });
    }
    toString() {
        return String(this.json["number"]);
    }
    savePopoverInfo(input_div) {
        this.json["number"] = Number(input_div.select("input").node().value.trim());
        super.savePopoverInfo(input_div);
    }
    getJSONs() {
        return [this.json["number"]];
    }
}

class RangeObject extends AbstractNumberObject {
    constructor(json, param, backpointers=new Set([])) {
        super(json, param, backpointers);
        if (!("lower" in this.json["extras"])) {
            this.json["extras"]["lower"] = json["number"];
        }
        if (!("upper" in this.json["extras"])) {
            this.json["extras"]["upper"] = json["number"]+1;
        }
        if (!("by" in this.json["extras"])) {
            this.json["extras"]["by"] = 1;
        }
    }
    getName() {
        return "range";
    }
    populatePopoverInput(cell_div, input_div, display) {
        super.populatePopoverInput(input_div);
        var input1 = input_div
          .append("input")
          .attr("inputnum", "1")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["lower"]);
        input_div
          .append("text")
          .attr("class", "inline")
          .html("to");
        var input2 = input_div
          .append("input")
          .attr("inputnum", "2")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["upper"]);
        input_div
          .append("text")
          .attr("class", "inline")
          .html("by");
        var input3 = input_div
          .append("input")
          .attr("inputnum", "3")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["by"]);

        $(cell_div.node()).on("shown.bs.popover", function(){
            input1.node().select();
            //taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input1.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
            input2.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
            input3.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
        });
    }
    toString() {
        return "Range: "+this.json["extras"]["lower"]+" to "+this.json["extras"]["upper"]+" by "+this.json["extras"]["by"];
    }
    savePopoverInfo(input_div) {
        var input1 = input_div.select('input[inputnum="1"]');
        var input2 = input_div.select('input[inputnum="2"]');
        var input3 = input_div.select('input[inputnum="3"]');
        this.json["extras"]["lower"] = Number(input1.node().value.trim());
        this.json["extras"]["upper"] = Number(input2.node().value.trim());
        this.json["extras"]["by"] = Number(input3.node().value.trim());
        this.json["number"] = this.json["extras"]["lower"];
        super.savePopoverInfo(input_div);
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
    constructor(json, param, backpointers=new Set([])) {
        super(json, param, backpointers);
        if (!("mean" in this.json["extras"])) {
            this.json["extras"]["mean"] = json["number"];
        }
        if (!("varience" in this.json["extras"])) {
            this.json["extras"]["variance"] = 0;
        }
        if (!("num_samples" in this.json["extras"])) {
            this.json["extras"]["num_samples"] = 1;
        }
    }
    getName() {
        return "normal dist";
    }
    populatePopoverInput(cell_div, input_div, display) {
        super.populatePopoverInput(input_div);
        input_div
          .append("text")
          .attr("class", "inline")
          .html("Mean:");
        var input1 = input_div
          .append("input")
          .attr("inputnum", "1")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["mean"]);
        input_div
          .append("text")
          .attr("class", "inline")
          .html("Variance:");
        var input2 = input_div
          .append("input")
          .attr("inputnum", "2")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["variance"]);
        input_div
          .append("text")
          .attr("class", "inline")
          .html("Number of Samples:");
        var input3 = input_div
          .append("input")
          .attr("inputnum", "3")
          .attr("class", "form-control inline")
          .attr("value", this.json["extras"]["num_samples"]);
        $(cell_div.node()).on("shown.bs.popover", function(){
            input1.node().select();
            // taken from https://www.w3schools.com/howto/howto_js_trigger_button_enter.asp
            // Execute a function when the user releases a key on the keyboard
            input1.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
            input2.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
            input3.node().addEventListener("keydown", function(event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                // Number 9 is the "Tab" key on the keyboard
                } else if (event.keyCode === 9) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    // Trigger the button element with a click
                    display.deselect();
                    $(cell_div.node()).focus();
                }
            });
        });
    }
    toString() {
        return "NormalDist("+this.json["extras"]["mean"]+", "+this.json["extras"]["variance"]+") x "+this.json["extras"]["num_samples"];
    }
    savePopoverInfo(input_div) {
        var input1 = input_div.select('input[inputnum="1"]');
        var input2 = input_div.select('input[inputnum="2"]');
        var input3 = input_div.select('input[inputnum="3"]');
        this.json["extras"]["mean"] = Number(input1.node().value.trim());
        this.json["extras"]["variance"] = Number(input2.node().value.trim());
        this.json["extras"]["num_samples"] = Number(input3.node().value.trim());
        this.json["number"] = this.json["extras"]["mean"];
        super.savePopoverInfo(input_div);
    }
    getJSONs() {
        var return_jsons = [];
        for(var i = 0; i < this.json["extras"]["num_samples"]; i++) {
            return_jsons.push(randn_bm());
        }
        return return_jsons;
    }
}

// TODO: extend this to have multiple references and a full equation
class IdentityNumberObject extends AbstractNumberObject {
    constructor(json, param, backpointers=new Set([])) {
        super(json, param, backpointers);
        this.needs_set_param = true;
        if (!("reference_prefix" in this.json["extras"])) {
            this.json["extras"]["reference_prefix"] = null;
            this.needs_set_param = false;
        }
        this.reference = null;
        this.reference_param_string = null;
        this.loop = false;
        this.loop_params = null;
        dependent_params.add(this.param);
    }
    getName() {
        return "identity";
    }
    toString() {
        if (this.loop) {
            return "Error: loop!";
        } else {
            if (this.reference_param_string == null) {
                return "Error: null!";
            } else {
                return this.reference_param_string+" (has dependency)";
            }
        }
    }
    display(cell_div) {
        if (this.json["extras"]["reference_prefix"] != null) {
            this.setParam(getViewerNode(this.json["extras"]["reference_prefix"]));
        }
        this.savePopoverInfo(null);
        super.display(cell_div);
        if (this.loop || (this.reference_param_string == null)) {
            cell_div.classed("error", true);
        }
    }
    populatePopoverInput(cell_div, input_div, display) {
        var temp_this = this;
        super.populatePopoverInput(input_div);
        input_div.append("button")
          .attr("class", "btn btn-primary")
          .html("Choose Param")
          .on("click", function(){ temp_this.chooseParam(display); });
        if (this.json["extras"]["reference_prefix"] == null) {
            input_div.append("text").html("null");
        } else {
            input_div.append("br");
            input_div.append("text").html(this.json["extras"]["reference_prefix"].join(' / '));
        }
        $(cell_div.node()).on("shown.bs.popover", function(){
            // TODO: click button maybe?
            // TODO: toggle popover with keys?
        });
    }
    savePopoverInfo(input_div) {
        var return_values = this.getReferenceParam();
        this.loop = return_values[0];
        if (this.loop) {
            this.loop_params = return_values[1];
        } else if (return_values[1] == null) {
            this.reference_param_string = null;
        } else {
            this.reference_param_string = return_values[1].object.toString();
        }
        super.savePopoverInfo(input_div);
    }
    getJSONs() {
        return [{"dependency_object": this.json}];
    }
    chooseParam(display) {
        display.deselect(false);
        editing_param = this;
        $('#chooseParamModal').modal('show');
    }
    setParam(param) {
        // remove backpointer
        if (this.reference != null) {
            this.reference.object.backpointers.delete(this.param);
        }
        // set reference
        this.reference = param;
        if (param != null){
            this.json["extras"]["reference_prefix"] = param.prefix();
            // set backpointer
            param.object.backpointers.add(this.param);
        } else {
            this.json["extras"]["reference_prefix"] = null;
        }
    }
    closeModal(param) {
        this.setParam(param);
        // open popover again
        this.param.displays["primary"].select();
    }
    getReferenceParam(path=new Set([])) {
        if (path.has(this.param)) {
            return [true, path];
        };
        if (this.reference == null) {
            return [false, null];
        } else if (this.reference.object instanceof IdentityNumberObject) {
            path.add(this.param);
            return this.reference.object.getReferenceParam(path);
        } else {
            return [false, this.reference];
        }
    }
    getValue(reference_value) {
        // this is where you would use an equation stored in this.json["extras"]
        // to turn reference parameter values into a value
        return reference_value;
    }
    refreshBackpointers() {
        if (this.loop) {
            for (let item of this.loop_params) {
                item.refreshDisplays(false);
            }
        } else {
            super.refreshBackpointers();
        }
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

function getJSONNode(json, prefix){
    prefix = prefix.slice(1);
    var curr = json;
    for (var i = 0; i < prefix.length; i++) {
        curr = curr[prefix[i]];
    }
    return curr;
}

// wrote so that it is easy to convert to params with multiple dependencies
function resolveDependency(json, param) {
    var dependencies = [param.object.reference];
    var dependency_values = [];
    var resolved_params = [];
    var prefix = param.prefix();
    var parent_json = getJSONNode(json, prefix.slice(0, prefix.length-1));
    for (var i = 0; i < dependencies.length; i++) {
        var value = null;
        if (dependencies[i] instanceof IdentityNumberObject) {
            var return_values = resolveDependency(json, dependencies[i]);
            var value = return_values[0];
            resolved_params.push(...return_values[1]);
        } else {
            var value = getJSONNode(json, dependencies[i].prefix());
        }
        dependency_values.push(value);
    }
    parent_json[prefix[prefix.length-1]] = param.object.getValue(dependency_values[0]);
    resolved_params.push(param);
    return [parent_json[prefix[prefix.length-1]], resolved_params];
}

// needs to be called after checkDependencies is satisfied!
function satisfyDependencies(json, dependent_params_copy=null) {
    if (dependent_params_copy == null) {
        dependent_params_copy = new Set(dependent_params);
    }
    while (dependent_params_copy.size > 0) {
        var param = dependent_params_copy.keys().next().value;
        resolved_dependency_params = resolveDependency(json, param)[1];
        dependent_params_copy = symmetricDifference(dependent_params_copy, new Set(resolved_dependency_params));
    }
}

function checkDependencies(dependent_params_copy=null){
    if (dependent_params_copy == null) {
        dependent_params_copy = new Set(dependent_params);
    }
    while (dependent_params_copy.size > 0) {
        var param = dependent_params_copy.keys().next().value;
        if (param.object.loop || param.object.reference == null) {
            return false;
        }
        dependent_params_copy.delete(param);
    }
    return true;
}

// taken from https://ourcodeworld.com/articles/read/189/how-to-create-a-file-and-generate-a-download-with-javascript-in-the-browser-without-a-server
function downloads() {
    if (!checkDependencies()) {
        alert("dependencies not okay!");
    } else {
        let zip = new JSZip();
        zip.file('template.json', JSON.stringify(json_viewer.json, undefined, 2));
        var jsons = json_viewer.getJSONs();
        for (var i = 0; i < jsons.length; i++) {
            satisfyDependencies(jsons[i]);
            zip.file('microsimulation_paramemters'+i+'.json', JSON.stringify(jsons[i], undefined, 2));
        }
        zip.generateAsync({type: "blob"}).then(function(content) {
            saveAs(content, 'microsimulation_paramemters.zip');
        });
    }
}

// taken from https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve/36481059#36481059
// Standard Normal variate using Box-Muller transform.
function randn_bm() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function modalSelectParam(param) {
    console.log(param.prefix());
    editing_param.closeModal(param);
    editing_param = null;
    $('#chooseParamModal').modal('hide');
}

function symmetricDifference(setA, setB) {
    let _difference = new Set(setA)
    for (let elem of setB) {
        if (_difference.has(elem)) {
            _difference.delete(elem)
        } else {
            _difference.add(elem)
        }
    }
    return _difference
}

function isNumberParam(v) {
    return (Object.keys(v).length == 2) && ("param" in v) && ("type" in v) && (v["type"] == "number");
}
function isBooleanParam(v) {
    return (Object.keys(v).length == 2) && ("param" in v) && ("type" in v) && (v["type"] == "boolean");
}
function isStringParam(v) {
    return (Object.keys(v).length == 2) && ("param" in v) && ("type" in v) && (v["type"] == "string");
}
