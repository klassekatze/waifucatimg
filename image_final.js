var urlm = require('url');
var request = require('cloudscraper').defaults({jar: true});
var sanitize = require('sanitize-filename');
var fs = require('fs');
var cheerio = require('cheerio');
const FileType = require('file-type');
var Jimp = require('jimp');

cheerio.prototype.size = function(){ return this.length; };
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
function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
String.prototype.replaceAll = function(find, replace)
{
	return this.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};



var image_extensions = ['.apng','.bmp','.jpg', '.gif', '.jpeg', '.jfif', '.pjpeg', '.pjp','.png'];
var image_hosts = ['steamuserimages-a.','qph.fs.quoracdn.net'];
var is_direct_link_to_image = function(url)
{
	for(var i  = 0; i < image_extensions.length; i++)
	{
		var url_novar = url.split('?')[0].toLowerCase();
		if(url_novar.endsWith(image_extensions[i]) || (url_novar.indexOf('.wikia.') != -1 && url_novar.indexOf(image_extensions[i]) != -1))return true;
		if(url_novar.indexOf(image_hosts) != -1)return true;
	}
	return false;
}

var smartnamedemangler = function(url)
{
	url = url.toLowerCase();
	for(var i  = 0; i < image_extensions.length; i++)
	{
		if(url.indexOf(image_extensions[i]) != -1)
		{
			var tokens = url.split('?')[0].split('/');
			for(var t  = 0; t < tokens.length; t++)
			{
				var curtok = tokens[t];
				if(curtok.indexOf(image_extensions[i]) != -1)
				{
					var ret = curtok;
					if(!ret.endsWith(image_extensions[i]))ret += image_extensions[i];
					ret = ret.replace(/[^a-z0-9\.]/gi, '_').toLowerCase();
					return ret;
				}
			}
		}
	}
	var ret = url.split('/')[url.split('/').length-1].split('?')[0];
	
	while(ret.length < 10)
	{
		ret = Math.floor(Math.random() * 10)+ret;
	}
	ret = ret.replace(/[^a-z0-9\.]/gi, '_').toLowerCase();
	return ret;
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
'www.pinterest.com':'[data-test-id="best-pin-card"] img',
'www.artstation.com':'.artwork-image img',
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
function sleep(time) {
    var stop = new Date().getTime();
    while(new Date().getTime() < stop + time) {
        ;
    }
}




var jsonstr = fs.readFileSync('imgcache.json').toString();
if(!jsonstr || jsonstr == '')jsonstr = '{}';
var IMAGE_CACHE_JSON = JSON.parse(jsonstr);

var FULL_IMAGE_DIR = 'imagecache_full';
var SCALE_IMAGE_DIR=  'imagecache_thumb';
//fs.mkdirSync(FULL_IMAGE_DIR);
//fs.mkdirSync(SCALE_IMAGE_DIR);

var addimagecache = function(key, val)
{
	IMAGE_CACHE_JSON[key]=val;
	console.log(key+'='+val);
	fs.writeFileSync('imgcache.json', ''+JSON.stringify(IMAGE_CACHE_JSON, null, '\t'));
}

var image_caching_queue = [];
var cache_image = function(url)
{
	var mainurl = urlm.parse(url);
	var selector = getselector(mainurl.host);
	if(selector != '' || is_direct_link_to_image(url))
	{
		if(image_caching_queue.indexOf(url) == -1)image_caching_queue.push(url);
	}
}

var demangle_url = function(host_url, url)
{
	if(host_url != url)
	{
		var mainurl = urlm.parse(host_url);
		var url_o = urlm.parse(url);
		if(!url_o.host && !url.startsWith('//'))
		{
			url_o.protocol = mainurl.protocol;
			url_o.host = mainurl.host;
			url = urlm.format(url_o);
		}
	}
	if(url.startsWith('//'))
	{
		if(host_url.startsWith('https'))url = 'https:'+url;
		else url = 'http:'+url;
	}
	return url;
}

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

var cache_image_direct_from_url = function(original_url, url)
{
	var asseturl = demangle_url(original_url, url);//just in case
	
	console.log('caching '+asseturl);
	//var imgname = asseturl.split('/')[asseturl.split('/').length-1].split('?')[0];
	var imgname = smartnamedemangler(asseturl);
	
	var destination = FULL_IMAGE_DIR+'/'+imgname;
	addimagecache(original_url,destination);
						
	if (!fs.existsSync(destination))
	{
		request({url:asseturl,headers:mkheaders(original_url),followRedirect:true,followAllRedirects:true})
		.on('error', function (err) {
			console.log('error on '+asseturl);
			sleep(100);
			setImmediate(cache_image_tick);
		}).pipe(fs.createWriteStream(destination))
		.on('error', function (err) {
			console.log('error '+err);
			sleep(100);
			setImmediate(cache_image_tick);
		}).on('close', function (err) {
			console.log('finished saving '+asseturl+' to '+destination);
			
			sleep(100);
			setImmediate(cache_image_tick);
		});
	}else
	{
		setImmediate(cache_image_tick);
	}
}



var sequential_tmr = 0;
var cache_image_tick = function()
{
	console.log('cache_image_tick('+image_caching_queue.length+')');
	if(image_caching_queue.length > 0)
	{
		var url = image_caching_queue.pop();
		if(is_direct_link_to_image(url))
		{
			cache_image_direct_from_url(url,url);
		}else
		{
			var r_url = url;
			if(url.indexOf('deviantart') != -1 && url.indexOf('backend.deviantart') == -1)
			{
				r_url = 'http://backend.deviantart.com/oembed?url='+url;
			}
			sleep(100);
			var reqo = request({url:r_url,headers:mkheaders(url),followRedirect:true,followAllRedirects:true}, function (error, res, body)
			{
				var waiting = false;
				if (!error && res.statusCode == 200)
				{
					sequential_tmr=0;
					var $ = cheerio.load(body);
					var mainurl = urlm.parse(url);
					var selector = getselector(mainurl.host);
					var img = $(selector).first();
					
					var asseturl = img.attr('src');
					
					//Special casing
					if(img.size() == 0)
					{
						if(url.indexOf('artstation') != -1)
						{
							asseturl = 'https://cdna.artstation.com/'+body.extract('https://cdna.artstation.com/','\\');
						}else if(r_url.indexOf('backend.deviantart') != -1)
						{
							var json = JSON.parse(body);
							asseturl = json.url;
						}else if(url.indexOf('pinterest') != -1)
						{
							asseturl = 'https://i.pinimg.com/originals/' + body.extract('https://i.pinimg.com/originals/','"');
						}else if(url.indexOf('imgur') != -1)
						{
							asseturl = $('link[rel="image_src"]').first().attr('href');
						}else if(url.indexOf('sankakucomplex') != -1 && body.indexOf('This post was deleted') != -1)
						{
							asseturl = $('#parent-preview img').attr('src');
						}
					}else if(!asseturl || asseturl.length == 0)//tumblr nonsense
					{
						asseturl = img.attr('srcset').split(' ')[0];
					}
					if(asseturl && asseturl != '')
					{
						asseturl = demangle_url(url, asseturl);
						if(asseturl && asseturl != '')
						{
							waiting=true;
							cache_image_direct_from_url(url, asseturl);
						}
					}
				}else
				{
					
					console.log(error);
					console.log(res.statusCode);
					sleep(100);
					if(res.statusCode == 429 || res.statusCode == 502)
					{
						sequential_tmr += 1;
						sleep(10000+(sequential_tmr*2000));
					}
					image_caching_queue.push(url);
				}
				if(!waiting)setImmediate(cache_image_tick);
			});
		}
	}else
	{
		rebuildqueues();
		image_rescale_tick();
	}
}

var deletions = false;
var iterations = 0;

var image_rescaling_queue = [];
var image_rescale_tick = function()
{
	console.log('image_rescale_tick('+image_rescaling_queue.length+')');
	if(image_rescaling_queue.length > 0)
	{
		var key = image_rescaling_queue.pop();
		var file = IMAGE_CACHE_JSON[key];
		var dest = file.replaceAll(FULL_IMAGE_DIR,SCALE_IMAGE_DIR);
		if (!fs.existsSync(dest))
		{
			Jimp.read(file, (err, lenna) =>
			{
				if (err)
				{
					console.log(file+' ERR '+err);
					if((err+'').indexOf('Could not find MIME for Buffer <null>') != -1)
					{
						addimagecache(key,'');
						deletions = true;
						//hmmm
					}else
					{
						addimagecache(key,dest);
						fs.copyFile(file, dest, (err) => {
							 if (err) throw err;
							 console.log('copied unscaled '+file);
							 //console.log('source.txt was copied to destination.txt');
						});
					}
				}else
				{
					addimagecache(key,dest);
					lenna.resize(325, Jimp.AUTO) // resize
					.quality(90) // set JPEG quality
					.write(dest); // save
					console.log('saved rescaled '+file);
				}
				setImmediate(image_rescale_tick);
			});
		}else
		{
			addimagecache(key,dest);
			setImmediate(image_rescale_tick);
		}
	}else
	{
		if(deletions && iterations < 5)
		{
			deletions = false;
			iterations += 1;
			rebuildqueues();
			cache_image_tick();
		}else
		{
			console.log('IMAGE COLLATION COMPLETE.');
		}
	}
}




var rebuildqueues = function()
{
	image_caching_queue = [];
	image_rescaling_queue = [];
	for (var key in IMAGE_CACHE_JSON)
	{
		if (Object.prototype.hasOwnProperty.call(IMAGE_CACHE_JSON, key))
		{
			if(IMAGE_CACHE_JSON[key] == '')
			{
				console.log('mkcaching '+key);
				cache_image(key);
			}else if(IMAGE_CACHE_JSON[key].indexOf(FULL_IMAGE_DIR) != -1)
			{
				image_rescaling_queue.push(key);
			}
		}
	}
}



rebuildqueues();

cache_image_tick();

