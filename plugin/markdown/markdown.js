
(function( root, factory ) {
	if (typeof define === 'function' && define.amd) {
		root.marked = require( './marked' );
		root.RevealMarkdown = factory( root.marked );
		root.RevealMarkdown.initialize();
	} else if( typeof exports === 'object' ) {
		module.exports = factory( require( './marked' ) );
	} else {

		root.RevealMarkdown = factory( root.marked );
		root.RevealMarkdown.initialize();
	}
}( this, function( marked ) {

	if( typeof marked === 'undefined' ) {
		throw 'The reveal.js Markdown plugin requires marked to be loaded';
	}

	if( typeof hljs !== 'undefined' ) {
		marked.setOptions({
			highlight: function( lang, code ) {
				return hljs.highlightAuto( lang, code ).value;
			}
		});
	}

	var DEFAULT_SLIDE_SEPARATOR = '^\r?\n---\r?\n$',
		DEFAULT_NOTES_SEPARATOR = 'note:',
		DEFAULT_ELEMENT_ATTRIBUTES_SEPARATOR = '\\\.element\\\s*?(.+?)$',
		DEFAULT_SLIDE_ATTRIBUTES_SEPARATOR = '\\\.slide:\\\s*?(\\\S.+?)$';

	var SCRIPT_END_PLACEHOLDER = '__SCRIPT_END__';



	function getMarkdownFromSlide( section ) {

		var template = section.querySelector( 'script' );


		var text = ( template || section ).textContent;


		text = text.replace( new RegExp( SCRIPT_END_PLACEHOLDER, 'g' ), '</script>' );

		var leadingWs = text.match( /^\n?(\s*)/ )[1].length,
			leadingTabs = text.match( /^\n?(\t*)/ )[1].length;

		if( leadingTabs > 0 ) {
			text = text.replace( new RegExp('\\n?\\t{' + leadingTabs + '}','g'), '\n' );
		}
		else if( leadingWs > 1 ) {
			text = text.replace( new RegExp('\\n? {' + leadingWs + '}', 'g'), '\n' );
		}

		return text;

	}


	function getForwardedAttributes( section ) {

		var attributes = section.attributes;
		var result = [];

		for( var i = 0, len = attributes.length; i < len; i++ ) {
			var name = attributes[i].name,
				value = attributes[i].value;

			
			if( /data\-(markdown|separator|vertical|notes)/gi.test( name ) ) continue;

			if( value ) {
				result.push( name + '="' + value + '"' );
			}
			else {
				result.push( name );
			}
		}

		return result.join( ' ' );

	}


	function getSlidifyOptions( options ) {

		options = options || {};
		options.separator = options.separator || DEFAULT_SLIDE_SEPARATOR;
		options.notesSeparator = options.notesSeparator || DEFAULT_NOTES_SEPARATOR;
		options.attributes = options.attributes || '';

		return options;

	}

	function createMarkdownSlide( content, options ) {

		options = getSlidifyOptions( options );

		var notesMatch = content.split( new RegExp( options.notesSeparator, 'mgi' ) );

		if( notesMatch.length === 2 ) {
			content = notesMatch[0] + '<aside class="notes">' + marked(notesMatch[1].trim()) + '</aside>';
		}


		content = content.replace( /<\/script>/g, SCRIPT_END_PLACEHOLDER );

		return '<script type="text/template">' + content + '</script>';

	}


	function slidify( markdown, options ) {

		options = getSlidifyOptions( options );

		var separatorRegex = new RegExp( options.separator + ( options.verticalSeparator ? '|' + options.verticalSeparator : '' ), 'mg' ),
			horizontalSeparatorRegex = new RegExp( options.separator );

		var matches,
			lastIndex = 0,
			isHorizontal,
			wasHorizontal = true,
			content,
			sectionStack = [];


		while( matches = separatorRegex.exec( markdown ) ) {
			notes = null;


			isHorizontal = horizontalSeparatorRegex.test( matches[0] );

			if( !isHorizontal && wasHorizontal ) {

				sectionStack.push( [] );
			}


			content = markdown.substring( lastIndex, matches.index );

			if( isHorizontal && wasHorizontal ) {

				sectionStack.push( content );
			}
			else {

				sectionStack[sectionStack.length-1].push( content );
			}

			lastIndex = separatorRegex.lastIndex;
			wasHorizontal = isHorizontal;
		}


		( wasHorizontal ? sectionStack : sectionStack[sectionStack.length-1] ).push( markdown.substring( lastIndex ) );

		var markdownSections = '';


		for( var i = 0, len = sectionStack.length; i < len; i++ ) {

			if( sectionStack[i] instanceof Array ) {
				markdownSections += '<section '+ options.attributes +'>';

				sectionStack[i].forEach( function( child ) {
					markdownSections += '<section data-markdown>' +  createMarkdownSlide( child, options ) + '</section>';
				} );

				markdownSections += '</section>';
			}
			else {
				markdownSections += '<section '+ options.attributes +' data-markdown>' + createMarkdownSlide( sectionStack[i], options ) + '</section>';
			}
		}

		return markdownSections;

	}


	function processSlides() {

		var sections = document.querySelectorAll( '[data-markdown]'),
			section;

		for( var i = 0, len = sections.length; i < len; i++ ) {

			section = sections[i];

			if( section.getAttribute( 'data-markdown' ).length ) {

				var xhr = new XMLHttpRequest(),
					url = section.getAttribute( 'data-markdown' );

				datacharset = section.getAttribute( 'data-charset' );


				if( datacharset != null && datacharset != '' ) {
					xhr.overrideMimeType( 'text/html; charset=' + datacharset );
				}

				xhr.onreadystatechange = function() {
					if( xhr.readyState === 4 ) {

						if ( ( xhr.status >= 200 && xhr.status < 300 ) || xhr.status === 0 ) {

							section.outerHTML = slidify( xhr.responseText, {
								separator: section.getAttribute( 'data-separator' ),
								verticalSeparator: section.getAttribute( 'data-separator-vertical' ),
								notesSeparator: section.getAttribute( 'data-separator-notes' ),
								attributes: getForwardedAttributes( section )
							});

						}
						else {

							section.outerHTML = '<section data-state="alert">' +
								'ERROR: The attempt to fetch ' + url + ' failed with HTTP status ' + xhr.status + '.' +
								'Check your browser\'s JavaScript console for more details.' +
								'<p>Remember that you need to serve the presentation HTML from a HTTP server.</p>' +
								'</section>';

						}
					}
				};

				xhr.open( 'GET', url, false );

				try {
					xhr.send();
				}
				catch ( e ) {
					alert( 'Failed to get the Markdown file ' + url + '. Make sure that the presentation and the file are served by a HTTP server and the file can be found there. ' + e );
				}

			}
			else if( section.getAttribute( 'data-separator' ) || section.getAttribute( 'data-separator-vertical' ) || section.getAttribute( 'data-separator-notes' ) ) {

				section.outerHTML = slidify( getMarkdownFromSlide( section ), {
					separator: section.getAttribute( 'data-separator' ),
					verticalSeparator: section.getAttribute( 'data-separator-vertical' ),
					notesSeparator: section.getAttribute( 'data-separator-notes' ),
					attributes: getForwardedAttributes( section )
				});

			}
			else {
				section.innerHTML = createMarkdownSlide( getMarkdownFromSlide( section ) );
			}
		}

	}


	function addAttributeInElement( node, elementTarget, separator ) {

		var mardownClassesInElementsRegex = new RegExp( separator, 'mg' );
		var mardownClassRegex = new RegExp( "([^\"= ]+?)=\"([^\"=]+?)\"", 'mg' );
		var nodeValue = node.nodeValue;
		if( matches = mardownClassesInElementsRegex.exec( nodeValue ) ) {

			var classes = matches[1];
			nodeValue = nodeValue.substring( 0, matches.index ) + nodeValue.substring( mardownClassesInElementsRegex.lastIndex );
			node.nodeValue = nodeValue;
			while( matchesClass = mardownClassRegex.exec( classes ) ) {
				elementTarget.setAttribute( matchesClass[1], matchesClass[2] );
			}
			return true;
		}
		return false;
	}


	function addAttributes( section, element, previousElement, separatorElementAttributes, separatorSectionAttributes ) {

		if ( element != null && element.childNodes != undefined && element.childNodes.length > 0 ) {
			previousParentElement = element;
			for( var i = 0; i < element.childNodes.length; i++ ) {
				childElement = element.childNodes[i];
				if ( i > 0 ) {
					j = i - 1;
					while ( j >= 0 ) {
						aPreviousChildElement = element.childNodes[j];
						if ( typeof aPreviousChildElement.setAttribute == 'function' && aPreviousChildElement.tagName != "BR" ) {
							previousParentElement = aPreviousChildElement;
							break;
						}
						j = j - 1;
					}
				}
				parentSection = section;
				if( childElement.nodeName ==  "section" ) {
					parentSection = childElement ;
					previousParentElement = childElement ;
				}
				if ( typeof childElement.setAttribute == 'function' || childElement.nodeType == Node.COMMENT_NODE ) {
					addAttributes( parentSection, childElement, previousParentElement, separatorElementAttributes, separatorSectionAttributes );
				}
			}
		}

		if ( element.nodeType == Node.COMMENT_NODE ) {
			if ( addAttributeInElement( element, previousElement, separatorElementAttributes ) == false ) {
				addAttributeInElement( element, section, separatorSectionAttributes );
			}
		}
	}


	function convertSlides() {

		var sections = document.querySelectorAll( '[data-markdown]');

		for( var i = 0, len = sections.length; i < len; i++ ) {

			var section = sections[i];

			// Only parse the same slide once
			if( !section.getAttribute( 'data-markdown-parsed' ) ) {

				section.setAttribute( 'data-markdown-parsed', true )

				var notes = section.querySelector( 'aside.notes' );
				var markdown = getMarkdownFromSlide( section );

				section.innerHTML = marked( markdown );
				addAttributes( 	section, section, null, section.getAttribute( 'data-element-attributes' ) ||
								section.parentNode.getAttribute( 'data-element-attributes' ) ||
								DEFAULT_ELEMENT_ATTRIBUTES_SEPARATOR,
								section.getAttribute( 'data-attributes' ) ||
								section.parentNode.getAttribute( 'data-attributes' ) ||
								DEFAULT_SLIDE_ATTRIBUTES_SEPARATOR);


				if( notes ) {
					section.appendChild( notes );
				}

			}

		}

	}


	return {

		initialize: function() {
			processSlides();
			convertSlides();
		},


		processSlides: processSlides,
		convertSlides: convertSlides,
		slidify: slidify

	};

}));
