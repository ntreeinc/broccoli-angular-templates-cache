var CachingWriter = require('broccoli-caching-writer'),
rsvp= require('rsvp'),
recursive = require('recursive-readdir'),
_ = require('lodash'),
htmlMin = require('html-minifier').minify,
fs = require("fs"),
mkdirp = require('mkdirp'),
path = require("path");

var reQuote = /'/g,
escapedQuote = '\\\'',
reNewLine = /\r?\n/g,
escapedNewLine = '\\n\' +\n \'';

function escapeHtmlContent(content) {
	return content.replace(reQuote, escapedQuote).replace(reNewLine, escapedNewLine);
}
function escapeTags(content) {
	return content.replace(/</mg, '&lt;').replace(/>/mg, '&gt;');
}
function angularModuleTemplate(moduleName, templateCode) {
	return 'angular.module("' + moduleName + '").run([\'$templateCache\', function(a) { ' + templateCode + ' }]);';
}
function transformTemplates(templates, strip, prepend, minify) {
	var cacheOutput = '',
	i = templates.length;
	while (i--) {
		cacheOutput += transformTemplateEntry(templates[i], strip, prepend, minify);
	}
	return cacheOutput;
}
function transformTemplateEntry(entry, strip, prepend, minify) {
	var path = entry.path,
	content = entry.content,
	parseError;
	
	// Normalize windows only
    if (process.platform === 'win32') {
      path = path.replace(/\\/g, '/');
    }


	if (strip) {
		path = path.split(strip);
		path.shift();
		path = path.join(strip).replace(/\\/g, '/');
	}
	if (prepend) {
		path = prepend + path;
	}
	if (minify !== false) {
		try {
			content = htmlMin(content, minify);
		} catch (e) {
			parseError = String(e);
			content = '<h1>Invalid template: ' + entry.path + '</h1>' +
			'<pre>' + escapeTags(parseError) + '</pre>';
		}
	}
	content = escapeHtmlContent(content);
	return 'a.put(\'' + path + '\', \'' + content + '\');\n\t';
}

var BroccoliAngularTemplateCache = function BroccoliAngularTemplateCache(inTree, options) {
	if (!(this instanceof BroccoliAngularTemplateCache)) {
    	return new BroccoliAngularTemplateCache(inTree, options);
  }
  this.inputTree = inTree;
  this.options = options || {};
	CachingWriter.apply(this, arguments);
};
BroccoliAngularTemplateCache.prototype = Object.create(CachingWriter.prototype);
BroccoliAngularTemplateCache.prototype.constructor = BroccoliAngularTemplateCache;
BroccoliAngularTemplateCache.prototype.description = 'angular templates cache';


BroccoliAngularTemplateCache.prototype.updateCache = function(srcDir, destDir) {
	
	var self 		= this;
	var templates 	= [];

	// normalize options
	var options 	= {
		minify 		: 	self.options.minify || false,
		prepend 	:	self.options.prepend || false,
		strip 		: 	self.options.strip || false,
		moduleName 	: 	self.options.moduleName,
		firstFile 	: 	null,
		srcDir 		: 	self.options.srcDir || './',
		fileName 	: 	self.options.fileName || 'template-cache.js',
		destDir  	: 	self.options.destDir || './',
		absolute 	: 	self.options.absolute || false
	};
 
	var src 		= 	path.join(srcDir[0], options.srcDir);
	var dest 		= 	path.join(destDir, options.destDir, options.fileName);

	mkdirp.sync(path.dirname(dest));

	var promise = new rsvp.Promise(function(fullfill, reject) {
		recursive(src, function (err, files) {

			_.each(files, function(fileLocation){

				if(! options.absolute){
					var file = fileLocation.replace(path.normalize(src), '');
				}
				
				templates.push({
					path: file || fileLocation,
					content: fs.readFileSync(fileLocation).toString('utf-8')
				});

			});

			var joinedContents = transformTemplates(templates, options.strip, options.prepend, options.minify);
			var module = angularModuleTemplate(options.moduleName, joinedContents);

			fs.writeFile(dest,module,function(err){
				if(err){
					reject(err);
				}else{
					fullfill('templates created');
				}
			});
		});
	});

	return promise;

}
module.exports = BroccoliAngularTemplateCache;
