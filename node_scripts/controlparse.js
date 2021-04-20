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



var bind_sift = function()
{
	var body = fs.readFileSync('Waifu Catalog Rules, Controls, Perks.html').toString();
	var $ = cheerio.load(body);
	
	var controls = $('<div></div>').append($('<p><span>'+body.extract('Binding-type Controls:','transformation begins.')+'transformation begins.</span></p>'));
	console.log($('p',controls).size());
	//console.log($('p').size());
	console.log($('p:contains(Type\:)',controls).size());
	var iter = $('p:contains(Type\:)',controls);
	iter.each( function( index, element )
	{
		var e = $(element);
		
		var name = e.prev().text().trim();
		var type = e.text().replaceAll('Type: ','').trim();
		var cost = e.next().text().trim();
		
		var description = [];
		var stop = false;
		var cur = e.next().next();
		do
		{
			var t = cur.text().trim();
			
			if(t.indexOf('Type:') != -1 || cur.size() != 1)stop=true;
			else if(t != '')description.push(t);
			
			if(cur == iter.last())stop=true;
			if(!stop)cur = cur.next();
		}while(!stop);
		description.pop();
		description = description.join('\n');
		
		console.log(name);
		console.log(type);
		console.log(cost);
		console.log('DESC');
		console.log(description);
	});
		//console.log(index);
	
	
	fs.writeFileSync('./DEBUG.txt', ''+controls.html());
}
bind_sift();