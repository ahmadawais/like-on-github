/**
 * LikeOnGitHub
 *
 * This file is part of the LikeOnGithub; an opensource Google Chrome extension
 * http://github.com/idnan/like-on-github
 *
 * MIT (c) Adnan Ahmed <mahradnan@hotmail.com>
 */
(function () {

    /**
     * Configuration constants for the extension
     *
     * @type {Object}
     */
    var Config = {

        // Templates
        MAIN_TEMPLATE: '<div class="logh">' +
        '<h3>Like On Github</h3>' +
        '<div class="clogl">' +
        '<div class="lbllogh">Title (label for the link)</div>' +
        '<input type="text" name="title">' +
        '</div>' +
        '<div class="clogl">' +
        '<input type="hidden" name="url">' +
        '</div>' +
        '<div class="clogl">' +
        '<div class="lbllogh">Comment (commit message)</div>' +
        '<textarea name="comment"></textarea>' +
        '</div>' +
        '<div id="action-btns">' +
        '<div class="btn btn-primary" id="logh_btn_save">Save</div>' +
        '<div class="btn" id="logh_btn_cancel">Cancel</div>' +
        '</div>' +
        '</div>',

        // References to DOM elements
        EX_COTAINER: '.logh',
        EX_INPUT_TITLE: '.logh input[name="title"]',
        EX_INPUT_URL: '.logh input[name="url"]',
        EX_INPUT_COMMENT: '.logh textarea[name="comment"]',
        EX_CONTAINER_BODY: 'body',
        EX_BTN_SAVE: '.logh #logh_btn_save',
        EX_BTN_CANCEL: '.logh #logh_btn_cancel',

        // Shortcut for activation
        MASTER_KEY: '⌘+⇧+l, ⌃+⇧+l',

        // Key codes for certain actions
        ESCAPE_KEY: 27,
    };

    var Storage = {

        /**
         * Get value from storage
         *
         * @param val
         * @returns {string}
         */
        get: function (val) {
            return localStorage.getItem(val) ? localStorage.getItem(val) : '';
        },
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

            chrome.extension.sendMessage({type: 'getActiveTab'}, function (tab) {

                if (!tab) {
                    return false;
                }

                ActiveTab.activeTab = tab;

                callback(ActiveTab.activeTab);
            });
        }
    };

    var Repo = {

        // fetch(url)
        //     .then(response => response.json())
        //     .then(response => {
        //         let sha = response.sha,
        //             encodedContent = response.content,
        //             decodedContent = decodeURIComponent(escape(window.atob(encodedContent)));
        //
        //         // If the file is empty
        //         if (decodedContent.trim().length === 0)
        //             decodedContent += '# today-i-liked \nContent that I liked. Saved using https://goo.gl/Wj595G \n';
        //
        //         // append header
        //         if (!isCurrentDateExists(decodedContent))
        //             decodedContent += getDateHeader();
        //
        //         // append url
        //         decodedContent += `- [${activeTab.title}](${activeTab.url}) \n`;
        //
        //         // decode content
        //         encodedContent = window.btoa(unescape(encodeURIComponent(decodedContent)));
        //
        //         // prepare commit
        //         return {
        //             sha: sha,
        //             content: encodedContent,
        //             message: `New link: ${activeTab.title}`,
        //             committer: {
        //                 'name': get('committer_name'),
        //                 'email': get('committer_email')
        //             }
        //         }
        //     }).then(commit => fetch(url, {
        //         method: 'PUT',
        //         headers: {
        //             'Content-Type': 'application/json'
        //         },
        //         body: JSON.stringify(commit)
        //     }))
        //     .then(success => setSuccessIcon())
        //     .catch(error => setErrorIcon());

        /**
         * Return date header
         *
         * @returns {string}
         */
        getDateHeader: function () {
            return `\n### ${getCurrentDate()} \n`;
        },

        /**
         * Check if current date already exists in the content
         *
         * @param content
         * @returns {boolean}
         */
        isCurrentDateExists: function (content) {
            return (content.indexOf(getCurrentDate()) !== -1);
        },

        /**
         * Return current
         *
         * @returns {string}
         */
        getCurrentDate: function () {
            const date = new Date();
            return `${monthNames()[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        },

        /**
         * Return month names
         *
         * @returns {string[]}
         */
        monthNames: function () {
            return [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
        },

        /**
         * Pad 0 if number is less than 10
         *
         * @param n
         * @returns {string}
         */
        pad: function (n) {
            return (n < 10) ? ('0' + n) : n;
        },

        /**
         * Set default icon
         */
        setDefaultIcon: function () {
            sleep(1000).then(() => chrome.browserAction.setIcon({path: 'icons/standard-16.png'}));
        },

        /**
         * Set success icon
         */
        setSuccessIcon: function () {
            chrome.browserAction.setIcon({path: 'icons/check-mark.png'});
            setDefaultIcon();
        },

        /**
         * Set error icon
         */
        setErrorIcon: function () {
            chrome.browserAction.setIcon({path: 'icons/cross-mark.png'});
            setDefaultIcon();
        },

        /**
         * Sleep execution
         *
         * @param time
         * @returns {boolean}
         */
        sleep: function (time) {
            return new Promise((resolve) => setTimeout(resolve, time));
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
         * Gets the action to be performed for the given keycode
         *
         * @param keyCode
         * @returns {*}
         */
        function getAction(keyCode) {
            switch (keyCode) {
                case Config.ESCAPE_KEY:
                    return Config.ESCAPING;
                default:
                    return false;
            }
        }

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

        /**
         * Hides the log on github popup
         */
        function closePopup() {

            let $container = $(Config.EX_COTAINER);

            if ($container.length === 0) {
                return false;
            }

            $(Config.EX_COTAINER).hide();
            $(Config.EX_INPUT_TITLE).val('');
            $(Config.EX_INPUT_URL).val('');
            $(Config.EX_INPUT_COMMENT).val('');

            return true;
        }

        /**
         * Gets the tab switcher element and makes it visible. If it cannot find the element creates it.
         */
        function showPopUp() {
            let $container = $(Config.EX_COTAINER);

            // Some pages remove the tab switcher HTML by chance
            // so we check if the tab switcher was found and we re append if it is not found
            if ($container.length === 0) {
                appendLikeOnGithubHtml(Config.EX_CONTAINER_BODY);
                $container = $(Config.EX_COTAINER);
            }

            $container.show();
        }

        return {

            /**
             * Loads the extension in specified container
             *
             * @param $container
             */
            loadExtension: function ($container) {
                appendLikeOnGithubHtml($container);
                this.bindUI();
            },

            /**
             * Binds the UI elements for the extension
             */
            bindUI: function () {

                // close on escape key
                $(document).on('keyup', function (e) {
                    if (e.keyCode === Config.ESCAPE_KEY) {
                        closePopup();
                    }
                });

                // if clicked outside the popup
                $(document).on('mouseup', function (e) {
                    let container = $(Config.EX_COTAINER);

                    if (!container.is(e.target) && container.has(e.target).length === 0) {
                        closePopup();
                    }
                });

                // hide the switcher on blurring of input
                $(document).on('click', Config.EX_BTN_CANCEL, function () {
                    closePopup();
                });

                // master key binding for which extension will be enabled
                key(Config.MASTER_KEY, function () {
                    showPopUp();
                    $(Config.EX_INPUT_TITLE).focus();

                    // get the active tab
                    ActiveTab.get(function (activeTab) {

                        if (!activeTab) {
                            return false;
                        }

                        $(Config.EX_INPUT_TITLE).val(activeTab.title);
                        $(Config.EX_INPUT_URL).val(activeTab.url);
                        $(Config.EX_INPUT_COMMENT).val('New Link: ' + activeTab.title);
                    });
                });
            }
        };
    }

    $(document).ready(function () {
        var likeOnGithub = new LikeOnGithub();
        likeOnGithub.loadExtension(Config.EX_CONTAINER_BODY);
    });

})();
