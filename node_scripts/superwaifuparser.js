
var urlm = require('url');
var request = require('cloudscraper').defaults({jar: true});
var sanitize = require('sanitize-filename');
var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
const FileType = require('file-type');
var Jimp = require('jimp');
cheerio.prototype.size = function(){ return this.length; };
var XLSX = require('xlsx');


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
var get_something_column = function(sheet, keywordlist)
{
	var bounds = extract_sheet_bounds(sheet);
	for(var c =bounds.cs; c <= bounds.ce; c++)
	{
		var title_cell = COLUMNALPHA[c]+'1';
		if(sheet[title_cell])
		{
			var title = (sheet[title_cell].v+'').toLowerCase();
			for(var t = 0; t < keywordlist.length; t++)
			{
				if(title.indexOf(keywordlist[t]) != -1)
				{
					return COLUMNALPHA[c];
				}
			}
		}
	}
	return '';
}




var WAIFU_COSTS = {};
var WAIFU_LIST = [];
var INTENSITY_LIST = [];
var WORLD_LIST = [];

var report_database = function()
{
	console.log('WAIFU_COSTS:'+Object.keys(WAIFU_COSTS).length);
	console.log('WAIFU_LIST:'+WAIFU_LIST.length);
	console.log('INTENSITY_LIST:'+INTENSITY_LIST.length);
	console.log('WORLD_LIST:'+WORLD_LIST.length);
}
var write_database = function()
{
	var database = {};
	database.WAIFU_COSTS = WAIFU_COSTS;
	database.INTENSITY_LIST = INTENSITY_LIST;
	database.WORLD_LIST = WORLD_LIST;
	database.WAIFU_LIST = WAIFU_LIST;
	fs.writeFileSync('catalog_databasev2.json', ''+JSON.stringify(database, null, '\t'));
}
var read_database = function()
{
	var database = {};
	var str = fs.readFileSync('catalog_databasev2.json').toString();
	if(!str || str == '' || str == 'undefined')str = '{}';
	database = JSON.parse(str);
	WAIFU_COSTS = database.WAIFU_COSTS;
	INTENSITY_LIST = database.INTENSITY_LIST;
	WORLD_LIST = database.WORLD_LIST;
	WAIFU_LIST = database.WAIFU_LIST;
}


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


var retrieve_intensity_budget_table = function(rules_filename)
{
	var body = fs.readFileSync(rules_filename).toString();
	var $ = cheerio.load(body);
	var intensity_table = $(body.extract('pick a starting world','</table>')+'</table>');
	console.log($('tr',intensity_table).size());
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
var construct_waifu_cost = function(tier, cost, sale)
{
	var ratingdat = {
				tier:parseInt(tier), cost:parseInt(cost), sale:parseInt(sale)
	};
	WAIFU_COSTS[parseInt(tier)] = ratingdat;
}
var T11_COST = 9999999;
var retrieve_waifu_costs_table = function(sheet)
{
	WAIFU_COSTS = {};
	//WAIFU_COSTS
	var tier_column = get_something_column(sheet,['tier']);
	var cost_column = get_something_column(sheet,['cost']);
	var capture_column = get_something_column(sheet,['capture']);
	var capturesale_column = get_something_column(sheet,['sale']);
	
	
	var bounds = extract_sheet_bounds(sheet);
	
	for(var r =bounds.rs+1; r <= bounds.re; r++)
	{
		var tier = parseInt((sheet[tier_column+''+r] ? sheet[tier_column+''+r].v : '').replaceAll('T',''));
		var cost = parseInt(sheet[cost_column+''+r] ? sheet[cost_column+''+r].v : '');
		var capture = parseInt(sheet[capture_column+''+r] ? sheet[capture_column+''+r].v : '');
		var sale = parseInt(sheet[capturesale_column+''+r] ? sheet[capturesale_column+''+r].v : '');
		
		if(tier == 11)
		{
			cost=T11_COST;
			capture=2000;
			sale=4000;
		}
		construct_waifu_cost(tier,cost,sale);
	}
	
	//var get_something_column = function(sheet, keywordlist)
}



{
	retrieve_intensity_budget_table('Waifu Catalog - Rules, Controls, Perks.html');
	var workbook = XLSX.readFile('./spreadsheets/Waifu Catalog CYOA draft.xlsx');
	retrieve_waifu_costs_table(workbook.Sheets['Waifu Costs']);
	//construct_world_entries(workbook.Sheets['World Ratings']);
}



var construct_world = function(intensity, world, condition, budget)
{
	var setting = {intensity:parseInt(intensity), world:world, condition:condition, budget:parseInt(budget)};
	WORLD_LIST.push(setting);
}
var construct_world_entries = function(sheet)
{
	var bounds = extract_sheet_bounds(sheet);
	var intensity_column = get_something_column(sheet,['intensity','rating','difficulty']);
	var world_column = get_something_column(sheet,['world','setting','name']);
	var condition_column = get_something_column(sheet,['condition']);
	
	
	
	for(var r =bounds.rs+1; r <= bounds.re; r++)
	{
		var intensity = parseInt(sheet[intensity_column+''+r] ? sheet[intensity_column+''+r].v : '');
		var world = sheet[world_column+''+r] ? sheet[world_column+''+r].v : '';
		var condition = sheet[condition_column+''+r] ? sheet[condition_column+''+r].v : '';
		var intensitydata = getintensity(intensity);
		if(intensitydata != null)
		{
			var budget = intensitydata.budget;
			construct_world(intensity, world, condition, budget)
			
		}else console.log('intnull');
		
		
		/*var intensity = parseInt(sheet[col_intensity+''+r] ? sheet[col_intensity+''+r].v : '');
		var world = sheet[col_world+''+r] ? sheet[col_world+''+r].v : '';
		var condition = sheet[col_condition+''+r] ? sheet[col_condition+''+r].v : '';
		
		var intensitydata = getintensity(intensity);
		if(intensitydata != null)
		{
			var budget = intensitydata.budget;
			construct_world(intensity, world, condition, budget)
			
		}else console.log('intnull');*/
	}
	console.log('world count: '+WORLD_LIST.length);
}







var constructwaifu = function(name, tier, art_url, cat1, cat2, doc)
{//art url is the ORIGINAL remote url, which will be translated to the image cache later
	tier = parseInt(tier);
	if(tier == 0 || tier+'' == 'NaN')
	{
		tier = 11;
		console.log('!!!STRANGE WAIFU RATING? NAME="'+name);
		//if(name == 'Dynamite Warrior Dash Fantastic')tier=
	}
	//strange waifu are as good as T11 for now, as SAN-check
	
	var waifu = {
		name:name,
		tier:parseInt(tier),
		art_url:art_url,
		cat1:cat1,
		cat2:cat2,
		doc:doc
	};
	WAIFU_LIST.push(waifu);
}

var image_extensions = ['.apng','.bmp','.jpg', '.gif', '.jpeg', '.jfif', '.pjpeg', '.pjp','.png'];
var image_hosts = ['steamuserimages-a.','qph.fs.quoracdn.net','pbs.twimg.com','encrypted-tbn0.gstatic.com'];
var is_direct_link_to_image = function(url)
{
	for(var i  = 0; i < image_extensions.length; i++)
	{
		var url_novar = url.split('?')[0].toLowerCase();
		if(url_novar.endsWith(image_extensions[i]) || (url_novar.indexOf('.wikia.') != -1 && url_novar.indexOf(image_extensions[i]) != -1))return true;
	}
	for(var i  = 0; i < image_hosts.length; i++)
	{
		if(url_novar.indexOf(image_hosts[i]) != -1)return true;
	}
	if(url.indexOf('static.wikia.nocookie.net') != -1 && url.indexOf('/images/') != -1 && url.indexOf('/latest') != -1)
	{
		return true;
	}
	return false;
}

var IMAGE_SITE_SELECTORS = {
'www.deviantart.com':'img[src*="images-wixmp"]',
'chan.sankakucomplex.com':'#post-content img',
'danbooru.donmai.us':'#content img#image',
'gelbooru.com':'#post-view img',
'ibb.co':'#image-viewer-container img',
'safebooru.org':'#content img',
'imgur.com':'div.image.post-image img',
'artgraveyard.tumblr.com':'.post .content img',
'hellyonwhite.tumblr.com':'main img',
'greyvestboy.tumblr.com':'main img',
'lie-ren.tumblr.com':'main img',
'www.pinterest.com':'[data-test-id="best-pin-card"] img',
'www.artstation.com':'.artwork-image img',
'www.zerochan.net':'.preview img',
'www.pixiv.net':'[role=presentation] img',
'e621.net':'section#image-container img',
'rule34.paheal.net':'section#Imagemain img',
'rule34.xxx':'div.post-view div.content img#image',
'www.pinterest.co.uk':'[data-test-id="UnauthBestPinCardLayoutContainer"] [data-test-id="pin-closeup-image"] img',
'funnyjunk.com':'div.mediaContainer .contentImage img',
'www.comicartcommunity.com':'img.ui.centered.image',
}
var getselector = function(host)
{
	var retval = '';
	Object.keys(IMAGE_SITE_SELECTORS).forEach(function(key)
	{
		//console.log(key);
		var value = IMAGE_SITE_SELECTORS[key];
		if(key == host)
		{
			//console.log('ret '+value);
			retval = value;
		}
	});
	return retval;
}
var is_image = function(url)
{
	if(is_direct_link_to_image(url))return true;
	var url_o = urlm.parse(url);
	if(getselector(url_o.host) != '')return true;
	return false;
}

var get_image_url_if_exists = function(comment)
{
	comment = comment.replaceAll('<br/>',' ');
	var spl = comment.split(' ');
	for(var i = 0; i < spl.length; i++)
	{
		try
		{
			if(is_image(spl[i]))
			{
				return spl[i];
			}
		}catch(e)
		{
			//no u wryyyyyyyyy
		}
	}
	return '';
}































var WORLD_SHEETS = [
'World Ratings',
'World Rating',
'World ratings',
];


//excluded sheet names
var EXCLUDED_SHEETS = [
'Waifu Costs',
'World Ratings',
'World Rating',
'Waifu Perks',
'Perks',
'World ratings',
'DLC: Generic Exalted',
'DLC Generic Exalted',

'Control and Perks',
'Waifu Catalog - New Controls',
'Unofficial Controls & Perks',


'Drawbacks',
'PerksBonuses',
'Powers',
'Gran',
'Husbano Costs',

'Sheet24',//what is this I don't even IT'S INVISIBLE

'R63 Expansion  (Moved to Husbando)',//Obsoleted by husbando catalog?...




];
var INCLUDED_SHEETS = ['Pokemon Expansion'];



var categorization_keywords = [
'franchise',
'home setting',
'series',
'source',
'medium','subcategory','subgroup','debut','exalted type', 'essence','caste','category','faction','class'];
var tier_keywords = ['tier','rating'];
var art_keywords = ['artwork','base image','art','image','picture'];
var name_keywords = ['name'];

var get_two_sorted_category_cells = function(sheet)
{
	var candidate = [];
	
	var bounds = extract_sheet_bounds(sheet);
	
	for(var cat = 0; cat < categorization_keywords.length; cat++)
	{
		var keyword = categorization_keywords[cat];
		
		for(var c =bounds.cs; c <= bounds.ce; c++)
		{
			var title_cell = COLUMNALPHA[c]+'1';
			if(sheet[title_cell])
			{
				var title = (sheet[title_cell].v+'');
				if(title.toLowerCase().indexOf(keyword) != -1)
				{
					candidate.push(COLUMNALPHA[c]);
				}
			}
		}
	}
	var ret = [];
	for(var i =0; i < candidate.length; i++)
	{
		if(ret.length < 2 && ret.indexOf(candidate[i]) == -1)ret.push(candidate[i]);
	}
	return ret;
}

var get_name_column = function(sheet)
{
	return get_something_column(sheet, name_keywords);
}
var get_art_column = function(sheet)
{
	return get_something_column(sheet, art_keywords);
}
var get_tier_column = function(sheet)
{
	return get_something_column(sheet, tier_keywords);
}

var create_waifu_database_entries = function(sheet, sheetname, sheetfile)
{
	
	var name_column = get_name_column(sheet);
	var art_column = get_art_column(sheet);
	var tier_column = get_tier_column(sheet);
	var cats = get_two_sorted_category_cells(sheet);

	var bounds = extract_sheet_bounds(sheet);
	
	for(var r =bounds.rs+1; r <= bounds.re; r++)
	{
		var name = sheet[name_column+''+r] ? sheet[name_column+''+r].v : '';
		var tier = sheet[tier_column+''+r] ? sheet[tier_column+''+r].v : '';
		
		var art_url = '';
		
		if(sheet[art_column+''+r])
		{
			art_url = (sheet[art_column+''+r].v+'').trim();
			if(art_url == 'undefined')art_url='';
			if(art_url == '')
			{
				if(sheet[col_art+''+r].hasOwnProperty('c'))//in Swift's catalog, there's a fair bit of blank art entries that have art commented on.
				{
					art_url = get_image_url_if_exists(sheet[col_art+''+r].c[0].h);
					if(art_url != '')
					{
					}
				}
			}
		}
		if(art_url.indexOf('/') == -1)art_url='';
		if(art_url != '' && get_image_url_if_exists(art_url) == '')console.log('mystery art? : '+art_url);
		
		
		var cat1='';
		var cat2='';
		if(cats.length > 0)cat1 = sheet[cats[0]+''+r] ? sheet[cats[0]+''+r].v : '';
		if(cats.length > 1)cat2 = sheet[cats[1]+''+r] ? sheet[cats[1]+''+r].v : '';
		
		if(cat1 == '' && cat2 == '')
		{
			cat1 = sheetname;
		}

		if(name != '' && tier != '')
		{
			constructwaifu(name, tier, art_url, cat1, cat2, sheetfile);
		}
	}
}
/*var waifu = {
		name:name,
		tier:parseInt(tier),
		art_url:art_url,
		cat1:cat1,
		cat2:cat2,
		doc:doc
	};*/
function waifu_compare(w1, w2)
{
	var m=0;
	if(w1.name == w2.name)m += 1;
	if(w1.tier == w2.tier)m += 1;
	//if(w1.art_url == w2.art_url)m += 1;
	if(w1.cat1 == w2.cat1)m += 1;
	if(w1.cat2 == w2.cat2)m += 1;
	//if(w1.doc == w2.doc)m += 1;
	return m;
}

function is_waifu_exact_match(w1, w2)
{
	if(w1.name == w2.name && w1.tier == w2.tier && w1.cat1 == w2.cat1 && w1.cat2 == w2.cat2)return true;
	if(w1.name == 'Keith Kaiser' && w2.name == 'Keith Kaiser')
	{
		console.log('!!!!!!!!!!!!!!!!!!!');
		console.log(w1.name == w2.name);
		console.log(w1.tier == w2.tier);
		console.log(w1.cat1 == w2.cat1);
		console.log(w1.cat2 == w2.cat2);
	}
	
	return false;
}
function chkforwaifuduplicate(w1, list)
{
	for(var i =0; i < list.length; i++)
	{
		var w2 = list[i];
		if(is_waifu_exact_match(w1,w2))
		{
			console.log('exact match on '+w1.name);
			return i;
		}
	}
	
	
	for(var i =0; i < list.length; i++)
	{
		var w2 = list[i];
		if(w1.name == w2.name)// && w1.tier == w2.tier)
		{
			if(w1.cat1 == w2.cat1 || w1.cat1 == w2.cat2)return i;
			if(w1.cat2 == w2.cat1 || w1.cat2 == w2.cat2)return i;
			console.log('approximate category and name match for '+w1.name);
		}
	}
	for(var i =0; i < list.length; i++)
	{
		var w2 = list[i];
		if(w1.name == w2.name)
		{
			if(w1.cat1 == w2.cat1 && w1.cat2 == w2.cat2)return i;
		}
	}
	return -1;
}


//destructive to input waifu data
function pickwaifu(w1, w2)
{
	var r = w1;
	if(w2.tier > w1.tier)r = w2;
	if(r.art_url == '')
	{
		if(w2.art_url != '')r.art_url = w2.art_url;
		if(w1.art_url != '')r.art_url = w1.art_url;
	}
	if(w1.tier > r.tier)r.tier = w1.tier;
	if(w2.tier > r.tier)r.tier = w2.tier;
	return r;
}
function countwaifu(name, list)
{
	var r= 0;
	for(var i =0; i < list.length; i++)
	{
		var w2 = list[i];
		if(w2.name == name)r += 1;
	}
	return r;
}

function waifu_deduplicate_exact()
{
	for(var i =0; i < WAIFU_LIST.length; i++)
	{
		var w = WAIFU_LIST[i];
		w.name = w.name.trim();
		w.art_url = w.art_url.trim();
		w.cat1 = w.cat1.trim();
		w.cat2 = w.cat2.trim();
		w.doc = w.doc.trim();
		WAIFU_LIST[i] = w;
	}
	
	
	var new_waifu = [];
	
	for(var i =0; i < WAIFU_LIST.length; i++)
	{
		var w1 = WAIFU_LIST[i];
		var dup = chkforwaifuduplicate(w1, new_waifu);
		var w2 = w1;
		if(dup != -1)w2 = new_waifu[dup];
		
		if(dup == -1)// || w1.doc == w2.doc)
		{
			if(w1.name == 'Keith Kaiser')
			{
				console.log('pushing keith');
			}
			new_waifu.push(w1);
		}else
		{
			var final_waifu = pickwaifu(w1, w2);
			//if(w1.name == 'Keith Kaiser')console.log('keiths:'+countwaifu('Keith Kaiser', new_waifu));
			new_waifu[dup] = final_waifu;
			//if(w1.name == 'Keith Kaiser')console.log('keiths:'+countwaifu('Keith Kaiser', new_waifu));
			//if(w1.name == 'Keith Kaiser')console.log('revising keith');
			//console.log('revising '+final_waifu.name);
		}
	}
	console.log('nemesis:'+countwaifu('Nemesis', new_waifu));
	WAIFU_LIST=new_waifu;
	//console.log('keiths:'+countwaifu('Keith Kaiser', WAIFU_LIST));
	
	
	/*for(var i =0; i < WAIFU_LIST.length; i++)
	{
		var waifu = WAIFU_LIST[i];
		if(waifu.name == 'Qrow Branwen')console.log('qrow');

		var exists = false;
		var overwrite = false;
		for(var b =0; b < new_waifu.length; b++)
		{
			var w2 = new_waifu[b];
			if(
			(waifu_compare(waifu, new_waifu[b]) > 3 && waifu.doc != new_waifu[b].doc) ||
			(waifu.name == new_waifu[b].name && waifu.tier == new_waifu[b].tier && waifu.cat1 == new_waifu[b].cat1 && waifu.cat2 == new_waifu[b].cat2 && waifu.doc == new_waifu[b].doc)
			
			)
			{
				//if(waifu.cat1 == '' || waifu.cat2 == '' && new_waifu[b].cat1 != ''
				{
					exists = true;
					b=new_waifu.length;
				}
			}else
			{
				
				if(waifu.name == w2.name && waifu.tier == w2.tier &&
				(waifu.cat1 == w2.cat1 || waifu.cat1 == w2.cat2 || waifu.cat2 == w2.cat1|| waifu.cat2 == w2.cat2))
				{
					if(waifu.name == 'Qrow Branwen')console.log('qrow2');
					if(waifu.art_url == '' && w2.art_url != '')
					{
						if(waifu.name == 'Qrow Branwen')console.log('qrow3');
						exists = true;
					}else if(waifu.art_url != '' && w2.art_url == '')
					{
						if(waifu.name == 'Qrow Branwen')console.log('qrow4');
						new_waifu[b] = waifu;
						exists = true;
						overwrite = true;
					}
				}
			}
		}
		if(!exists && !overwrite)
		{
			new_waifu.push(waifu);
		}
	}*/
	//WAIFU_LIST=new_waifu;
}
function waifu_duplicate_check()
{
	console.log('running high-match duplicate');
	console.log(WAIFU_LIST.length);
	waifu_deduplicate_exact();
	console.log(WAIFU_LIST.length);
	
	console.log('running duplicate scan');
	for(var i =0; i < WAIFU_LIST.length; i++)
	{
		var waifu = WAIFU_LIST[i];
		
		for(var b =i+1; b < WAIFU_LIST.length; b++)
		{
			if(b != i)
			{
				var waifu_comp = WAIFU_LIST[b];
				
				if(waifu.name == waifu_comp.name && waifu.cat1 == waifu_comp.cat1)
				{
					console.log('name match:'+waifu.name+' from '+waifu.doc+' and '+waifu_comp.doc);
				}
			}
		}
	}
}









var is_valid_waifu_sheet = function(sheet)
{
	var bounds = extract_sheet_bounds(sheet);
	
	var name = get_name_column(sheet) != '';
	var art = get_art_column(sheet) != '';
	var category = get_two_sorted_category_cells(sheet).length > 0;
	var tier = get_tier_column(sheet) != '';
	return name && art && tier;
}

//https://naruto.fandom.com/wiki/Special:Search?query=Umamusume:+Pretty+Derby+winning+ticket&scope=cross-wiki
//Umamusume:+Pretty+Derby+winning+ticket
var spreadsheets = [];
fs.readdirSync('spreadsheets').forEach(function(file)
{
	if(file.indexOf('~lock') == -1)spreadsheets.push(file);
	//else fs.unlinkSync(file);
});


for(var i = 0; i < spreadsheets.length; i++)
{
	var sheet_file = spreadsheets[i];
	var workbook = XLSX.readFile('./spreadsheets/'+sheet_file);
	console.log(sheet_file);
	var fpre = WAIFU_LIST.length;
	for(var s =0; s < workbook.SheetNames.length; s++)
	{
		var sheet_name = workbook.SheetNames[s];
		titles = [];
		if(EXCLUDED_SHEETS.indexOf(sheet_name.trim()) == -1)
		{
			var sheet = workbook.Sheets[sheet_name];
			var pre = WAIFU_LIST.length;
			create_waifu_database_entries(sheet, sheet_name, sheet_file);

		}else if(WORLD_SHEETS.indexOf(sheet_name.trim()) != -1)
		{
			var sheet = workbook.Sheets[sheet_name];
			construct_world_entries(sheet);
		}
	}
	console.log('added '+(WAIFU_LIST.length - fpre) +' waifus from '+sheet_file);
}

waifu_duplicate_check();
report_database();
write_database();




var IMAGE_CACHE_V3 = [];
var read_image_cache = function()
{
	IMAGE_CACHE_V3 = {};
	var str = '';
	try{var str = fs.readFileSync('IMAGE_CACHE_V3.json').toString();}catch(e){}
	if(!str || str == '' || str == 'undefined')str = '{}';
	IMAGE_CACHE_V3 = JSON.parse(str);
}
var write_image_cache = function()
{
	fs.writeFileSync('IMAGE_CACHE_V3.json', ''+JSON.stringify(IMAGE_CACHE_V3, null, '\t'));
}

//addimagecache

function get_create_image_cache_by_url(url)
{
	for(var i = 0; i < IMAGE_CACHE_V3.length; i++)
	{
		var entry = IMAGE_CACHE_V3[i];
		if(entry.url == url)
		{
			return entry;
		}
	}
	var entry= {url:url,file:'',thumb:'',statically:''};
	IMAGE_CACHE_V3.push(entry);
	return entry;
}
function set_image_in_cache(cache)
{
	for(var i = 0; i < IMAGE_CACHE_V3.length; i++)
	{
		var entry = IMAGE_CACHE_V3[i];
		if(entry.url == cache.url)
		{
			IMAGE_CACHE_V3[i] = cache;
			return ;
		}
	}
	//else
	IMAGE_CACHE_V3.push(cache);
}

function imgcache_get_full_file_from_url(url)
{
	return get_create_image_cache_by_url(url).file;
}
function imgcache_get_thumb_from_url(url)
{
	return get_create_image_cache_by_url(url).thumb;
}
//imgcache_set_file(url, file)
//imgcache_set_thumb(url, thumb)
function imgcache_set_file(url, file)
{
	var c = get_create_image_cache_by_url(url);
	c.file = file;
	set_image_in_cache(c);
	write_image_cache();
}
function imgcache_set_thumb(url, thumb)
{
	var c = get_create_image_cache_by_url(url);
	c.thumb = thumb;
	set_image_in_cache(c);
	write_image_cache();
}

read_image_cache();






for(var i =0; i < WAIFU_LIST.length; i++)
{
	var waifu = WAIFU_LIST[i];
	
	var art = '';
	var c1 = get_create_image_cache_by_url(waifu.art_url);
}
write_image_cache();
console.log('instanced all art urls to imgcache');




var deadcards = '<div class="card mb-4 shadow-sm nullcard">\
						<!--null card-->\
					</div>';
deadcards=deadcards+deadcards;


var make_single_waifu_card = function(cat1, cat2, name, rating, art_url, art_origin)
{
	var card = '';
	if(parseInt(rating) < 1 || parseInt(rating) > 11)
	{
		
		console.log('!!!STRANGE RATING: '+name+':'+rating);
	}else
	{
	
		var cost = WAIFU_COSTS[parseInt(rating)].cost;
		var sell = WAIFU_COSTS[parseInt(rating)].sale;
		card = '\n\
		<div class="card mb-4 shadow-sm hidden willshow_"\n\
		data-name="'+name+'"\n\
		data-tier="'+rating+'"\n\
		data-cost="'+cost+'"\n\
		>\n\
			<div class="card-header">\n\
				<h4 class="my-0 font-weight-normal">'+name+'</h4>\n\
			</div>\n';
		
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
		if(cat1 != '')card += cat1+'<br>\n';
		if(cat2 != '')card += cat2+'<br>\n';
		if(rating != '')card += 'Tier: '+rating+'<br>\n';
		card += 'Purchase: <span class="purchase">'+cost+'</span><br>\n\
					Sells for: '+sell+'\n\
				</p>\n\
				<div class="d-flex justify-content-between align-items-center">\n\
					<button type="button" class="btn_waifu btn-block btn btn-success">Buy</button>\n\
				</div>\n\
			</div>\n\
		</div>\n';
	}
	return card;
}


var make_waifu_cards = function()
{
	var waifu_cards = '';
	for(var i =0; i < WAIFU_LIST.length; i++)
	{
		var waifu = WAIFU_LIST[i];
		//if(!waifu.art_url)waifu.art_url = [];
		
		var art = '';
		var c1 = get_create_image_cache_by_url(waifu.art_url);
		if(c1.thumb && c1.thumb != '')art = c1.thumb;
		if(c1.statically && c1.statically != '')
		{
			//console.log('using static');
			art = c1.statically;
		}
		/*if(waifu.art_url == 'https://comicvine1.cbsistatic.com/uploads/scale_medium/11112/111121983/4731027-catelyn.jpg')
		{
			console.log('set~!');
			console.log('art='+art);
		}*/
		var card = make_single_waifu_card(waifu.cat1, waifu.cat2, waifu.name, waifu.tier, art, waifu.art_url)
		waifu_cards += card;
	}
	waifu_cards += deadcards;
	fs.writeFileSync('waifu_cards.html',waifu_cards);
	console.log('waifu cards written.');
}


make_waifu_cards();




function mkblurb()
{
	var intro_blurb = '';
	var today  = new Date();
	
	intro_blurb += '<p><b>Compiled '+today.toLocaleDateString("en-US")+'</b></p>';
	
	intro_blurb += '<p>Worlds: <b>'+WORLD_LIST.length+'</b></p>';
	intro_blurb += '<p>Waifus: <b>'+WAIFU_LIST.length+'</b></p>';
	
	intro_blurb += '<p><b>Included Sheets: '+spreadsheets.length+'</b></p><p>';
	for(var i =0; i < spreadsheets.length; i++)
	{
		intro_blurb += spreadsheets[i]+'</br>';
	}
	intro_blurb += '</p>';
	
	
	fs.writeFileSync('intro_blurb.html',intro_blurb);
}
mkblurb();

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

make_setting_cards();

write_image_cache();
/*var titles = [];
for(var i = 0; i < spreadsheets.length; i++)
{
	var sheet_file = spreadsheets[i];
	var workbook = XLSX.readFile('./spreadsheets/'+sheet_file);
	console.log(sheet_file);
	for(var s =0; s < workbook.SheetNames.length; s++)
	{
		var sheet_name = workbook.SheetNames[s];
		titles = [];
		if(EXCLUDED_SHEETS.indexOf(sheet_name.trim()) == -1)
		{
			var sheet = workbook.Sheets[sheet_name];
			var bounds = extract_sheet_bounds(sheet);
			
			//var has_art = false;
			for(var c =bounds.cs; c <= bounds.ce; c++)
			{
				var title_cell = COLUMNALPHA[c]+'1';
				if(sheet[title_cell])
				{
					var title = sheet[title_cell].v+'';
					if(titles.indexOf(title.toLowerCase()) == -1)titles.push(title.toLowerCase());
				}
				
				
			}
			console.log('\t'+ (is_valid_waifu_sheet(sheet) ? 'Y' : 'N' ) +' '+sheet_name);
		}
		console.log('\t\t'+titles.join(', '));
	}
}*/





