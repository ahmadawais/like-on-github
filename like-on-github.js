/**
 * LikeOnGitHub.
 *
 * @link https://github.com/ahmadawais/like-on-github
 */
(function () {
	var Helper = {
		/**
		 * Get meta description.
		 */
		getMetaDescription: function () {
			var metas = document.getElementsByTagName('meta');
			for (var i in metas) {
				if (typeof metas[i].name != 'undefined' && metas[i].name.toLowerCase() == 'description') {
					return metas[i].content;
				}
			}
			return '';
		},
		/**
		 * Hides the log on github popup
		 */
		closePopup: function () {
			let $container = $(Config.EX_COTAINER);

			if ($container.length === 0) {
				return false;
			}

			Helper.resetPopupHtml();

			$(Config.EX_COTAINER).hide();
			$(Config.EX_INPUT_TITLE).val('');
			$(Config.EX_INPUT_DESC).val('');
			$(Config.EX_INPUT_URL).val('');
			$(Config.EX_INPUT_COMMENT).val('');

			return true;
		},

		/**
		 * Gets the tab switcher element and makes it visible. If it cannot find the element creates it.
		 */
		showPopup: function () {
			let $container = $(Config.EX_COTAINER);

			// Some pages remove the tab switcher HTML by chance.
			// So we check if the tab switcher was found and we re append if it is not found.
			if ($container.length === 0) {
				appendLikeOnGithubHtml(Config.EX_CONTAINER_BODY);
				$container = $(Config.EX_COTAINER);
			}

			$container.show();
		},

		/**
		 * Reset the html of the popup
		 */
		resetPopupHtml: function () {
			$(Config.EX_BTN_SAVE).text('Save');

			$(Config.EX_ERROR_CONTAINER).hide();
			$(Config.EX_ERROR_LINE).html('');
		},

		/**
		 * Validate the form fields
		 */
		isFormValid: function () {
			let title = $(Config.EX_INPUT_TITLE).val().trim(),
				desc = $(Config.EX_INPUT_DESC).val().trim(),
				comment = $(Config.EX_INPUT_COMMENT).val().trim();

			return !!(title && desc && comment);
		},
	};

	var Storage = {
		/**
		 * Get value from storage
		 *
		 * @returns {string}
		 * @param callback
		 */
		getRepoUrl: function (callback) {
			chrome.extension.sendMessage(
				{
					type: 'getStorage',
					params: {
						keys: ['owner', 'repo', 'path', 'token', 'committer_name', 'committer_email'],
					},
				},
				function (res) {
					callback(res);
				}
			);
		},
	};

	/**
	 * Configuration constants for the extension
	 *
	 * @type {Object}
	 */
	var Config = {
		// Templates.
		MAIN_TEMPLATE: `
<div class="logh">
	<h3>Like On Github</h3>
	<div class="clogl">
		<div class="lbllogh">Title</div>
		<input type="text" name="title" />
	</div>
	<div class="clogl">
		<div class="lbllogh">Description</div>
		<textarea name="desc"></textarea>
	</div>
	<div class="clogl">
		<input type="hidden" name="comment" />
	</div>
	<div class="clogl">
		<input type="hidden" name="url" />
	</div>
	<div id="action-btns">
		<div class="btn btn-primary" id="logh_btn_save">Save</div>
		<div class="btn" id="logh_btn_cancel">Cancel</div>
	</div>
	<div class="elogh hlogh">
		<p></p>
	</div>
</div>
`,

		// References to DOM elements.
		EX_COTAINER: '.logh',
		EX_INPUT_TITLE: '.logh input[name="title"]',
		EX_INPUT_DESC: '.logh textarea[name="desc"]',
		EX_INPUT_URL: '.logh input[name="url"]',
		EX_INPUT_COMMENT: '.logh textarea[name="comment"]',
		EX_CONTAINER_BODY: 'body',
		EX_BTN_SAVE: '.logh #logh_btn_save',
		EX_BTN_CANCEL: '.logh #logh_btn_cancel',
		EX_ERROR_CONTAINER: '.logh .elogh',
		EX_ERROR_LINE: '.logh .elogh p',

		// Shortcut for activation.
		MASTER_KEY: '⌘+⇧+l, ⌃+⇧+l',

		// Key codes for certain actions.
		ESCAPE_KEY: 27,
		ENTER_KEY: 13,

		// REPO.
		BASE_URL: 'https://api.github.com/repos',
	};

	/**
	 * Houses all the browser related actions
	 *
	 * @type {Object}
	 */
	var ActiveTab = {
		activeTab: false,

		/**
		 * Return current selected tab
		 *
		 * @returns {*}
		 */
		get: function (callback) {
			let activeTab = ActiveTab.activeTab;

			if (activeTab) {
				callback(activeTab);
			}

			chrome.extension.sendMessage({ type: 'getActiveTab' }, function (tab) {
				if (!tab) {
					return false;
				}

				ActiveTab.activeTab = tab;

				callback(ActiveTab.activeTab);
			});
		},
	};

	var Repo = {
		commitLike: function (items) {
			let repoUrl = `${Config.BASE_URL}/${items['owner']}/${items['repo']}/contents/${items['path']}?access_token=${items['token']}`;

			if (!repoUrl) {
				return false;
			}

			let activeTabTitle = $(Config.EX_INPUT_TITLE).val(),
				activeTabDesc = $(Config.EX_INPUT_DESC).val(),
				activeTabUrl = $(Config.EX_INPUT_URL).val(),
				commitMessage = $(Config.EX_INPUT_COMMENT).val();

			fetch(repoUrl)
				.then((response) => response.json())
				.then((response) => {
					let sha = response.sha,
						encodedContent = response.content,
						decodedContent = decodeURIComponent(escape(window.atob(encodedContent)));

					const dataToAppend = `- [${activeTabTitle}](${activeTabUrl})${activeTabDesc ? ` - ${activeTabDesc}` : `.`}\n`;

					// Append data in the front.
					decodedContent = Repo.appendDataBefore(dataToAppend, decodedContent);

					// Decode content.
					encodedContent = window.btoa(unescape(encodeURIComponent(decodedContent)));

					// Prepare commit.
					return {
						sha: sha,
						content: encodedContent,
						message: commitMessage,
						committer: {
							name: items['committer_name'],
							email: items['committer_email'],
						},
					};
				})
				.then((commit) =>
					fetch(repoUrl, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(commit),
					})
				)
				.then((success) => {
					$(Config.EX_BTN_SAVE).text('Save');

					success.json().then((res) => {
						$(Config.EX_ERROR_CONTAINER).show();

						let message = '';
						if (success.status && success.status === 200) {
							message = '✅ <a href="' + res.commit.html_url + '" target="_blank">All done!</a>';

							// Close the popup after 5 secs.
							setTimeout(function () {
								Helper.closePopup();
							}, 5000);
						} else {
							message = res.message;
						}

						$(Config.EX_ERROR_LINE).html(message);
						$(Config.EX_BTN_SAVE).removeClass('saving');
					});
				})
				.catch((error) => {
					$(Config.EX_BTN_SAVE).removeClass('saving').text('Save');
				});
		},

		/**
		 * Append data in the front
		 * @param dataToAppend
		 * @param content
		 * @returns {String}
		 */
		appendDataBefore: function (dataToAppend, content) {
			// If the file is empty.
			if (content.trim().length === 0) {
				content += '# today-i-liked \nContent that I liked. Saved using https://goo.gl/Wj595G \n';
			}

			const arr = content.split('###');

			// If the length of array is 1, then it is the first time to append data.
			if (arr.length === 1) {
				arr[0] += Repo.getDateHeader();
				arr[0] += dataToAppend;
				content = arr.join('');
			} else {
				// If has not append data of currentDate, then append DateHeader.
				if (!Repo.isCurrentDateExists(content)) {
					arr[0] += Repo.getDateHeader();
					arr[0] += dataToAppend;
				} else {
					// If already have date then append to that.
					arr[1] += dataToAppend;
				}
				content = arr.join('###');
			}
			return content;
		},

		/**
		 * Return date header
		 *
		 * @returns {string}
		 */
		getDateHeader: function () {
			return `\n### ${Repo.getCurrentDate()} \n`;
		},

		/**
		 * Check if current date already exists in the content
		 *
		 * @param content
		 * @returns {boolean}
		 */
		isCurrentDateExists: function (content) {
			return content.indexOf(Repo.getCurrentDate()) !== -1;
		},

		/**
		 * Return current
		 *
		 * @returns {string}
		 */
		getCurrentDate: function () {
			const date = new Date();
			return `${Repo.monthNames()[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
		},

		/**
		 * Return month names
		 *
		 * @returns {string[]}
		 */
		monthNames: function () {
			return [
				'January',
				'February',
				'March',
				'April',
				'May',
				'June',
				'July',
				'August',
				'September',
				'October',
				'November',
				'December',
			];
		},
	};

	/**
	 * Main extension class
	 *
	 * @returns {{loadExtension: loadExtension, bindUI: bindUI}}
	 * @constructor
	 */
	function LikeOnGithub() {
		/**
		 * Appends the tab switcher HTML to the $container
		 *
		 * @param $container
		 * @returns {*}
		 */
		function appendLikeOnGithubHtml($container) {
			if (!($container instanceof jQuery)) {
				$container = $($container);
			}

			$container.append(Config.MAIN_TEMPLATE);
			return $container;
		}

		return {
			/**
			 * Loads the extension in specified container
			 *
			 * @param $container
			 */
			loadExtension: function ($container) {
				appendLikeOnGithubHtml($container);
				const desc = Helper.getMetaDescription();
				this.bindUI(desc);
			},

			/**
			 * Binds the UI elements for the extension
			 */
			bindUI: function (desc) {
				// Close on escape key.
				$(document).on('keyup', function (e) {
					if (e.keyCode === Config.ESCAPE_KEY) {
						Helper.closePopup();
					}
					if (e.keyCode == 13 && e.metaKey) {
						$(Config.EX_BTN_SAVE).click();
					}
				});

				// If clicked outside the popup.
				$(document).on('mouseup', function (e) {
					let container = $(Config.EX_COTAINER);

					if (!container.is(e.target) && container.has(e.target).length === 0) {
						Helper.closePopup();
					}
				});

				// Hide the switcher on blurring of input.
				$(document).on('click', Config.EX_BTN_CANCEL, function () {
					Helper.closePopup();
				});

				// Hide the switcher on blurring of input.
				$(document).on('click', Config.EX_BTN_SAVE, function () {
					let saveBtn = $(Config.EX_BTN_SAVE);

					if (saveBtn.hasClass('saving') || !Helper.isFormValid()) {
						return false;
					}

					Helper.resetPopupHtml();

					saveBtn.addClass('saving').text('Saving...');

					Storage.getRepoUrl(function (items) {
						// Commit the like.
						if (items) {
							Repo.commitLike(items);
						}
					});
				});

				// Master key binding for which extension will be enabled.
				key(Config.MASTER_KEY, function () {
					Helper.showPopup();

					$(Config.EX_INPUT_DESC).focus();
					// Get the active tab.
					ActiveTab.get(function (activeTab) {
						if (!activeTab) {
							return false;
						}
						$(Config.EX_INPUT_TITLE).val(activeTab.title);
						$(Config.EX_INPUT_DESC).val(desc);
						$(Config.EX_INPUT_URL).val(activeTab.url);
						$(Config.EX_INPUT_COMMENT).val('📦 NEW: ' + activeTab.title);
					});
				});
			},
		};
	}

	$(document).ready(function () {
		var likeOnGithub = new LikeOnGithub();
		likeOnGithub.loadExtension(Config.EX_CONTAINER_BODY);
	});
})();
