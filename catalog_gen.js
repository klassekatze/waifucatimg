var XLSX = require('xlsx');
var urlm = require('url');
var request = require('request').defaults({jar: true});
var fs = require('fs');
var cheerio = require('cheerio');
cheerio.prototype.size = function(){ return this.length; };


function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
String.prototype.replaceAll = function(find, replace)
{
	return this.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};
String.prototype.extract = function(prefix, suffix) {
	s = this;
	var i = s.indexOf(prefix);
	if (i >= 0) {
		s = s.substring(i + prefix.length);
	}
	else {
		return '';
	}
	if (suffix) {
		i = s.indexOf(suffix);
		if (i >= 0) {
			s = s.substring(0, i);
		}
		else {
		  return '';
		}
	}
	return s;
};


var COLUMNALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var extract_sheet_bounds = function(sheet)
{
	var ref = sheet['!ref'].split(':');
	//console.log(ref);
	var column_start = COLUMNALPHA.indexOf(ref[0].substring(0,1));
	var column_end = COLUMNALPHA.indexOf(ref[1].substring(0,1));
	var row_start = parseInt(ref[0].substring(1));
	var row_end = parseInt(ref[1].substring(1));
	return { cs: column_start, ce: column_end, rs: row_start, re: row_end };
}


//aight
//worlds, which determine budget, and budget is derived from their tier against the intensity table from the ruledoc
//controls
//perks

//these two can include things such as shroud, home, etc which can be purchased multipole times up to a limit.

//waifu, which have costs derived from their tier against the cost table in the sheet. at least one control/perk can apply multiplier to said costs
//waifu perks, which require a specific waifu - hardcoding this is unnecessary, depending on effort rrequired

var RATING_DATA = [];
var construct_rating = function(tier, cost, capture)
{
	var ratingdat = {
				tier:parseInt(tier), cost:parseInt(cost), capture:parseInt(capture)
	};
	RATING_DATA.push(ratingdat);
}
var getratingdata = function(tier)
{
	for(var i =0; i < RATING_DATA.length; i++)
	{
		if(RATING_DATA[i].tier == tier)
		{
			//console.log(RATING_DATA[i].tier+','+tier+','+RATING_DATA[i].cost);
			return RATING_DATA[i];
			
		}
	}
	return null;
}

var WAIFU_LIST = [];
var constructwaifu = function(name, tier, art_url, medium, setting)
{//art url is the ORIGINAL remote url, which will be translated to the image cache later
	tier = parseInt(tier);
	if(tier == 0 || tier+'' == 'NaN')tier = 11;
	//strange waifu are as good as T11 for now, as SAN-check
	
	var waifu = {
		name:name,
		tier:parseInt(tier),
		art_url:art_url,
		medium:medium,
		setting:setting
	};
	WAIFU_LIST.push(waifu);
}
var INTENSITY_LIST = [];
var construct_intensity = function(intensity, title, budget)
{
	var intensity = {intensity:parseInt(intensity), title:title, budget:parseInt(budget)};
	INTENSITY_LIST.push(intensity);
}
var getintensity = function(intensity)
{
	for(var i =0; i < INTENSITY_LIST.length; i++)
	{
		if(INTENSITY_LIST[i].intensity == intensity)
		{
			return INTENSITY_LIST[i];
		}
	}
	return null;
}

var WORLD_LIST = [];
var construct_world = function(intensity, world, condition, budget)
{
	var setting = {intensity:parseInt(intensity), world:world, condition:condition, budget:parseInt(budget)};
	WORLD_LIST.push(setting);
}
var write_database = function()
{
	var database = {};
	database.RATING_DATA = RATING_DATA;
	database.INTENSITY_LIST = INTENSITY_LIST;
	database.WORLD_LIST = WORLD_LIST;
	database.WAIFU_LIST = WAIFU_LIST;
	fs.writeFileSync('catalog_database.json', ''+JSON.stringify(database, null, '\t'));
}


var retrieve_intensity_budget_table = function(rules_filename)
{
	var body = fs.readFileSync(rules_filename).toString();
	var $ = cheerio.load(body);
	var intensity_table = $(body.extract('pick a starting world','</table>')+'</table>');
	console.log('intens:'+$('tr',intensity_table).size());
	var f = 0;
	$('tr',intensity_table).each( function( index, element )
	{
		var e = $(element);
		if(f > 0)
		{
			var cells = $('td',e);
			var level = $(cells.get(0)).text().trim();
			var title = $(cells.get(1)).text().trim();
			var budget = $(cells.get(2)).text().trim();
			construct_intensity(level, title, budget)
		}
		f += 1;
	});
	
}
var T11_COST = 999999;
var retrieve_waifu_cost_table = function(sheet)
{
	var bounds = extract_sheet_bounds(sheet);
	
	var col_tier = '-';
	var col_cost = '-';
	var col_capture = '-';
	
	for(var c =bounds.cs; c <= bounds.ce; c++)
	{
		var title = COLUMNALPHA[c]+'1';
		if(sheet[title])
		{
			var t = sheet[title].v ? t = sheet[title].v : '';
			if(t.toLowerCase().indexOf('tier') != -1)col_tier=COLUMNALPHA[c];
			else if(t.toLowerCase().indexOf('cost') != -1)col_cost=COLUMNALPHA[c];
			else if(t.toLowerCase().indexOf('capture') != -1)col_capture=COLUMNALPHA[c];
		}
	}
	//console.log(col_tier+';'+col_cost+';'+col_capture);
	
	for(var r =bounds.rs+1; r <= bounds.re; r++)
	{
		var tier = parseInt((sheet[col_tier+''+r] ? sheet[col_tier+''+r].v : '').replaceAll('T',''));
		var cost = sheet[col_cost+''+r] ? sheet[col_cost+''+r].v : '';
		if(cost == 'N/A')cost = T11_COST;
		else cost = parseInt(cost);
		var capture = sheet[col_capture+''+r] ? sheet[col_capture+''+r].v : '';
		if(cost == T11_COST)capture = 0;
		else capture = parseInt(capture);
		//console.log(tier+';'+cost+';'+capture);
		construct_rating(tier, cost, capture);
	}
	console.log('waifu ratings: '+RATING_DATA.length);
}

var category_filters = [
{a:'medium',b:'setting'},
{a:'category',b:'series'},
{a:'debut',b:'squad'},
{a:'faction',b:'class'},
{a:'explored in',b:'area'},
];
var construct_official_waifu_entries = function(sheet)
{
	var bounds = extract_sheet_bounds(sheet);
	
	var col_name = '-';
	var col_tier = '-';
	var col_art = '-';
	var col_medium = '-';
	var col_setting = '-';
	
	for(var c =bounds.cs; c <= bounds.ce; c++)
	{
		var title = COLUMNALPHA[c]+'1';
		if(sheet[title])
		{
			var t = sheet[title].v;
			if(t == 'Name')col_name=COLUMNALPHA[c];
			else if(t == 'Rating')col_tier=COLUMNALPHA[c];
			else if(t == 'Artwork')col_art=COLUMNALPHA[c];
			
			for(var i = 0; i < category_filters.length; i++)
			{
				if(col_medium == '-' && t.toLowerCase().indexOf(category_filters[i].a) != -1)col_medium=COLUMNALPHA[c];
				if(col_setting == '-' && t.toLowerCase().indexOf(category_filters[i].b) != -1)col_setting=COLUMNALPHA[c];
			}
		}
	}
	for(var r =bounds.rs+1; r <= bounds.re; r++)
	{
		var name = sheet[col_name+''+r] ? sheet[col_name+''+r].v : '';
		var tier = sheet[col_tier+''+r] ? sheet[col_tier+''+r].v : '';
		var art_url = sheet[col_art+''+r] ? sheet[col_art+''+r].v : '';
		
		var setting = sheet[col_setting+''+r] ? sheet[col_setting+''+r].v : '';
		var medium = sheet[col_medium+''+r] ? sheet[col_medium+''+r].v : '';
		
		if(name != '' && tier != '')
		{
			constructwaifu(name, tier, art_url, medium, setting);
		}
	}
}


var construct_world_entries = function(sheet)
{
	var bounds = extract_sheet_bounds(sheet);
	
	var col_intensity = '-';
	var col_world = '-';
	var col_condition = '-';
	
	for(var c =bounds.cs; c <= bounds.ce; c++)
	{
		var title = COLUMNALPHA[c]+'1';
		if(sheet[title])
		{
			var t = sheet[title].v;
			if(t == 'Danger Rating')col_intensity=COLUMNALPHA[c];
			else if(t == 'World')col_world=COLUMNALPHA[c];
			else if(t == 'Condition')col_condition=COLUMNALPHA[c];
		}
	}
	for(var r =bounds.rs+1; r <= bounds.re; r++)
	{
		var intensity = parseInt(sheet[col_intensity+''+r] ? sheet[col_intensity+''+r].v : '');
		var world = sheet[col_world+''+r] ? sheet[col_world+''+r].v : '';
		var condition = sheet[col_condition+''+r] ? sheet[col_condition+''+r].v : '';
		
		var intensitydata = getintensity(intensity);
		if(intensitydata != null)
		{
			var budget = intensitydata.budget;
			construct_world(intensity, world, condition, budget)
			
		}else console.log('intnull');
	}
	console.log('world count: '+WORLD_LIST.length);
}



var deadcards = '<div class="card mb-4 shadow-sm nullcard">\
						<!--null card-->\
					</div>';
deadcards=deadcards+deadcards;
var make_setting_cards = function()
{
	var setting_cards = '';
	
	for(var i =0; i < WORLD_LIST.length; i++)
	{
		var world = WORLD_LIST[i];
		if(world.world != '')
		{
			var intensitydata = getintensity(world.intensity);
			if(intensitydata != null)
			{
				var budget = intensitydata.budget;
				
				var card =
				'<div class="card mb-4 shadow-sm"\
				data-name="'+world.world+'"\
				data-tier="'+world.intensity+'"\
				data-budget="'+budget+'"\
				>\
					<div class="card-header"><h4 class="my-0 font-weight-normal">'+world.world+'</h4></div>\
					<div class="card-body">\
						<h1 class="card-title pricing-card-title"><small class="text-muted">Tier:</small> '+world.intensity+'</h1>\
						Condition: '+(world.condition != '' ? world.condition : 'None')+'<br>\
						<h1 class="card-title pricing-card-title"><small class="text-muted">Budget:</small> '+budget+'</h1>\
						<br>\
						<div class="d-flex justify-content-between align-items-center">\
							<button type="button" class="world_select_btn btn btn-lg btn-block btn-outline-success">Select</button>\
						</div>\
					</div>\
				</div>';
				setting_cards += card;
			}
		}
	}
	setting_cards += deadcards;
	fs.writeFileSync('setting_cards.html',setting_cards);
	console.log('setting cards written.');
}


var make_single_waifu_card = function(medium, setting, name, rating, art_url, art_origin)
{
	//console.log(rating);
	var cost = getratingdata(parseInt(rating)).cost;
	var sell = getratingdata(parseInt(rating)).capture;
	var card = '\n\
	<div class="card mb-4 shadow-sm"\n\
	data-name="'+name+'"\n\
	data-tier="'+rating+'"\n\
	data-cost="'+cost+'"\n\
	>\n\
		<div class="card-header">\n\
			<h4 class="my-0 font-weight-normal">'+name+'</h4>\n\
		</div>\n';
	//if(art_url.length > 0)
	{
		if(art_url.length == 0)art_url = 'img/placeholder.jpg';
		card += 
		'<img class="bd-placeholder-img card-img-top cover" width="100%" src="'+art_url+'"/>\n';
		if(art_origin != '')card += 
		'<p class="text-left"><small>(art from: <a href="'+art_origin+'" target="_blank">link</a>)</small></p>';
	}
	card += '\
		<div class="card-body d-flex flex-column">\n\
			<p class="card-text mt-auto">\n';
	if(medium != '')card += medium+'<br>\n';
	if(setting != '')card += setting+'<br>\n';
	if(rating != '')card += 'Tier: '+rating+'<br>\n';
	card += 'Purchase: <span class="purchase">'+cost+'</span><br>\n\
				Sells for: '+sell+'\n\
			</p>\n\
			<div class="d-flex justify-content-between align-items-center">\n\
				<button type="button" class="btn_waifu btn-block btn btn-success">Buy</button>\n\
			</div>\n\
		</div>\n\
	</div>\n';
	return card;
}

var make_waifu_cards = function()
{
	var waifu_cards = '';
	for(var i =0; i < WAIFU_LIST.length; i++)
	{
		var waifu = WAIFU_LIST[i];
		
		var art = '';
		if(waifu.art_url in IMAGE_CACHE_JSON)art = IMAGE_CACHE_JSON[waifu.art_url];
		
		var card = make_single_waifu_card(waifu.medium, waifu.setting, waifu.name, waifu.tier, art, waifu.art_url)
		waifu_cards += card;
	}
	waifu_cards += deadcards;
	fs.writeFileSync('waifu_cards.html',waifu_cards);
	console.log('waifu cards written.');
}




//a crude, fragile mechanism for my worm bias
var retrieve_waifu_html = function(document_body_string)
{
	var $ = cheerio.load(document_body_string);
	//var tables = $('table');
	
	var tablecheer = $('<table'+document_body_string.extract('<table','</table>')+'</table>');
	//console.log(body.extract('pick a starting world','</table>'))
	//console.log($('tr',tablecheer).size());
	var f = 0;
	var col_name = -1;
	var col_tier = -1;
	var col_art = -1;
	var col_medium = -1;
	var col_setting = -1;
	$('tr',tablecheer).each( function( index, element )
	{
		var e = $(element);
		//console.log(index);
		if(index == 1)
		{
			//console.log(e.html());
			$('td',e).each( function( idx, cellement )
			{
				var cell = $(cellement);
				//console.log(cell.html());
				//console.log(cell.text().trim().toLowerCase());
				if(cell.text().trim().toLowerCase() == 'name')col_name=idx;
				else if(cell.text().trim().toLowerCase() == 'tier')col_tier=idx;
				else if(cell.text().trim().toLowerCase().indexOf('art') != -1)col_art=idx;
				
				for(var i = 0; i < category_filters.length; i++)
				{
					if(cell.text().trim().toLowerCase().indexOf(category_filters[i].a) != -1)col_medium=idx;
					if(cell.text().trim().toLowerCase().indexOf(category_filters[i].b) != -1)col_setting=idx;
				}
			});
			//console.log(col_name+';'+col_tier+';'+col_art+';'+col_medium+';'+col_setting);
		}
		
		if(index != 1)
		{
			var cells = $('td',e);
			var name = $(cells.get(col_name)).text().trim();
			var tier = $(cells.get(col_tier)).text().trim();
			var art = $(cells.get(col_art)).text().trim();
			var medium = $(cells.get(col_medium)).text().trim();
			var setting = $(cells.get(col_setting)).text().trim();
			if(name != '' && tier != '')
			{
				//console.log('added '+name);
				constructwaifu(name,tier,art,medium,setting);
			}
		}
	});
}







console.log('retrieve_intensity_budget_table');
retrieve_intensity_budget_table('Waifu Catalog Rules, Controls, Perks.html');


var workbook = XLSX.readFile('Waifu Catalog CYOA.xlsx');
var non_waifu_sheets = ['Waifu Costs','World Ratings','DLC: Generic Exalted'];

retrieve_waifu_cost_table(workbook.Sheets['Waifu Costs']);

construct_world_entries(workbook.Sheets['World Ratings']);

for(var i =0; i < workbook.SheetNames.length; i++)
{
	var sheet_name = workbook.SheetNames[i];
	if(non_waifu_sheets.indexOf(sheet_name) == -1)
	{
		construct_official_waifu_entries(workbook.Sheets[sheet_name]);
	}
}

retrieve_waifu_html(fs.readFileSync('Unofficial Waifu Catalog expansion - Parahumans edition - Google Drive.html').toString());

console.log('waifu count: '+WAIFU_LIST.length);

var jsonstr = fs.readFileSync('imgcache.json').toString();
if(!jsonstr || jsonstr == '')jsonstr = '{}';
var IMAGE_CACHE_JSON = JSON.parse(jsonstr);

var addimagecache = function(key, val)
{
	IMAGE_CACHE_JSON[key]=val;
	console.log(key+'='+val);
	fs.writeFileSync('imgcache.json', ''+JSON.stringify(IMAGE_CACHE_JSON, null, '\t'));
}



for(var i =0; i < WAIFU_LIST.length; i++)
{
	var waifu = WAIFU_LIST[i];
	
	var art = '';
	if(waifu.art_url in IMAGE_CACHE_JSON)art = IMAGE_CACHE_JSON[waifu.art_url];
	else
	{
		addimagecache(waifu.art_url,'');
	}
}
console.log('copied all art original urls to imgcache.json');

console.log('constructing catalog cards.');
console.log('NOTE: this uses the imagecache.json just updated to determine available images. if there are new waifu, run image_final after this and then run catalog_gen once more.');
make_setting_cards();
make_waifu_cards();




write_database();





