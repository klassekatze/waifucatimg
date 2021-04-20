//https://api.statically.io/gh/repos/klassekatze/waifucatimg/commits/master

var urlm = require('url');
var request = require('cloudscraper').defaults({jar: true});
var sanitize = require('sanitize-filename');
var fs = require('fs');
var cheerio = require('cheerio');
const FileType = require('file-type');
var Jimp = require('jimp');


var mkheaders = function(url)
{
	var headers = {
	//'Accept-Encoding': '',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
	'content-type': 'application/x-www-form-urlencoded',
	'X-Requested-With': 'XMLHttpRequest',
	'origin': url,
	'referer': url,
	'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
	};
	return headers;
}

function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
String.prototype.replaceAll = function(find, replace)
{
	return this.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};




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


//https://github.com/klassekatze/waifucatimg/commit/ba102c8eb61b00dcaa77d9db64dc55a183b730e4
var url = 'https://api.statically.io/gh/repos/klassekatze/waifucatimg/commits/master';
var reqo = request({url:url,headers:mkheaders(url),followRedirect:true,followAllRedirects:true}, function (error, res, body)
{
	var waiting = false;
	if (!error && res.statusCode == 200)
	{
		var stat = JSON.parse(body);
		//console.log(stat.files.length);
		var sha = stat.sha.substring(0,8);
		var durl = 'https://cdn.statically.io/gh/klassekatze/waifucatimg/'+sha+'/imagecache_thumb';
		console.log(durl);
		
		for(var i = 0; i < IMAGE_CACHE_V3.length; i++)
		{
			var c1 = IMAGE_CACHE_V3[i];
			if(c1.url != '')
			{
				if(c1.thumb != '')// && (c1.statically == '')
				{
					c1.statically = c1.thumb.replaceAll('imagecache_thumb',durl);
					set_image_in_cache(c1);
				}
			}
		}
		write_image_cache();
		/*for (var key in IMAGE_CACHE_JSON)
		{
			if (Object.prototype.hasOwnProperty.call(IMAGE_CACHE_JSON, key))
			{
				if(IMAGE_CACHE_JSON[key].indexOf('cdn.statically.io') == -1)
				{
					STATIC_CACHE[key] = IMAGE_CACHE_JSON[key].replaceAll('imagecache_thumb',durl);
				}else
				{
					STATIC_CACHE[key] = IMAGE_CACHE_JSON[key];
				}
			}
		}*/
	}
});