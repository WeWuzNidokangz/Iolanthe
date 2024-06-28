/*
* Tour code manager
*/

const fs = require('fs');

const Mashups = exports.Mashups = require('./index.js');
const DataDownloader = exports.DataDownloader = require('./../../data-downloader.js');

const allSettled = require('promise.allsettled');

// Needs: npm install @octokit/core octokit-plugin-create-pull-request
const { Octokit } = require("@octokit/core");
const { createPullRequest } = require("octokit-plugin-create-pull-request");

const TourCodesURLRoot = 'https://raw.githubusercontent.com/OperationTourCode/OTC/master/';
const FormatsPathExtension = 'formats/';
const MashupsPathExtension = 'mashups/';
const MetadataPathExtension = 'metadata/';
const TourExt = '.tour';
const TextExt = '.txt';
const ListFName = 'list' + TextExt;
const ListSeparator = '\n';

const FormatsURLRoot = TourCodesURLRoot + FormatsPathExtension;

const OfficialsFName = 'officialslist' + TextExt;
const DailyRawContentFName = 'dailyschedule' + TextExt;
const MashupsPopularRandomFormatsFName = 'popularrandomformats' + TextExt;
const SpotlightNamesFName = 'spotlightnames' + TextExt;

const MashupsURLRoot = TourCodesURLRoot + MashupsPathExtension;
const DailyRawContentURL = MashupsURLRoot + DailyRawContentFName;
const MashupsPopularRandomFormatsURL = MashupsURLRoot + MashupsPopularRandomFormatsFName;
const SpotlightNamesURL = MashupsURLRoot + SpotlightNamesFName;
const OfficialListURL = MashupsURLRoot + OfficialsFName;

const AliasesFName = 'aliases' + TextExt;
const DynamicFormatDescriptionsFName = 'dynamicformatdescriptions' + TextExt;

const GeneralMetadataURLRoot = TourCodesURLRoot + MetadataPathExtension;
const ListURL = GeneralMetadataURLRoot + ListFName;
const DynamicFormatDescriptionsURL = GeneralMetadataURLRoot + DynamicFormatDescriptionsFName;
const AliasesURL = GeneralMetadataURLRoot + AliasesFName;

const LocalOTCRoot = 'operationtourcode/';
const LocalOTCFormatsPath = LocalOTCRoot + FormatsPathExtension;
const LocalOTCMashupsPath = LocalOTCRoot + MashupsPathExtension;
const LocalOTCMetadataPath = LocalOTCRoot + MetadataPathExtension;

const NotFoundErrorText = '404: Not Found';

const LocalDataRoot = './data/';
const GenMashupFormatsRoot = LocalDataRoot + 'genmashupformats/';
const GenMashupFormatsTemplatesRoot = GenMashupFormatsRoot + 'templates/';
const CommentHeaderTemplatePath = GenMashupFormatsTemplatesRoot + 'commentheader.tmp';
const FormatTemplatePath = GenMashupFormatsTemplatesRoot + 'format.tmp';
const FormatListTemplatePath = GenMashupFormatsTemplatesRoot + 'formatlist.tmp';
const ArrayTemplatePath = GenMashupFormatsTemplatesRoot + 'array.tmp';
const SectionHeaderTemplatePath = GenMashupFormatsTemplatesRoot + 'sectionheader.tmp';
const ThreadTemplatePath = GenMashupFormatsTemplatesRoot + 'thread.tmp';
const GenMashupFormatsOutputRoot = GenMashupFormatsRoot + 'output/';
const GenMashupFormatsFName = 'generated-mashup-formats.ts';
const MashupFormatsOutputPath = GenMashupFormatsOutputRoot + GenMashupFormatsFName;

const TourNameLinePrefix = '/tour name ';
const TourNameMissingFallback = 'Unknown Format';
const TourBaseFormatNewLinePrefix = '/tour new ';
const TourBaseFormatCreateLinePrefix = '/tour create ';
const TourBaseFormatStartTourLinePrefix = '/starttour ';
const TourBaseFormatMissingFallback = '[Gen 9] OU';
const TourBaseFormatModMissingFallback = 'gen9';
const TourDeltaRulesLinePrefix = '/tour rules ';
const TourDescriptionMissingFallback = '(No description)';
const TourInlineNameSeparator = ',,,';

const GenericResourcesLink = exports.GenericResourcesLink = 'https://www.smogon.com/forums/threads/om-mashup-megathread.3657159/#post-8299984';
const MashupsGeneratedFormatsColumn = 1;
const DailyNotificationBeginWarningFromRemainingMinutes = 20;
const DailyNotificationCheckFrequencyMinutes = 10;
const DailyNotificationCheckFrequencyMilliseconds = (1000 * 60 * DailyNotificationCheckFrequencyMinutes);

var OfficialTourCodesNamesArray = exports.OfficialTourCodesNamesArray = [];
var OtherTourCodesNamesArray = exports.OtherTourCodesNamesArray = [];
var AllTourCodesNamesArray = exports.AllTourCodesNamesArray = [];

var AllTourCodesDictionary = exports.AllTourCodesDictionary = {};
var TourCodeURLsDictionary = {};
var DynamicFormatDescriptionsDictionary = {};
var AliasesDictionary = {};
var MashupsPopularRandomFormatsWeightsDictionary = {};
var DynamicFormatsRawDictionary = {};

var SpotlightNamesArray = exports.SpotlightNamesArray = [];

var DailyRawContent = exports.DailyRawContent = 'Uninit';
var DailyDayDictionary = exports.DailyDayDictionary = {};
var DailyCycleDictionary = exports.DailyCycleDictionary = {};
var SpotlightStartDate = exports.SpotlightStartDate = null;
var DailyCheckIntervalID = -1;

//#region Dictionary Utils

var sortByKeyLength = function (dict)
{
    var sortedKeyArray = Object.keys(dict);
    sortedKeyArray.sort((a, b) => b.length - a.length);

    var tempDict = {};
    for (var nItr = 0; nItr < sortedKeyArray.length; nItr++) {
        tempDict[sortedKeyArray[nItr]] = dict[sortedKeyArray[nItr]];
    }

    return tempDict;
}

//#endregion

//#region Random Tour

const RandomTourCategory = exports.RandomTourCategory = Object.freeze({
	'Any':      'any',
	'Official': 'official',
	'Other':    'other',
	'Popular':  'popular',
});

var tryGetRandomTourCodeForCategory = exports.tryGetRandomTourCodeForCategory = function (commandContext, sCategoryName)
{
    if ('' === sCategoryName) {
        sCategoryName = RandomTourCategory.Any;
    }
    sCategoryName = toId(sCategoryName);

    let searchTCArray = null;
    if (!Object.values(RandomTourCategory).includes(sCategoryName)) {
        // Try to to use category term as a search value
        searchTCArray = tryTourCodeSearch(commandContext, sCategoryName);
        if (!searchTCArray || (0 == searchTCArray.length)) { // Invalid category error
            const sParamNames = Object.values(RandomTourCategory).join(', ');
            commandContext.reply(`Invalid category: ${sCategoryName}! Valid fixed categories: ${sParamNames} (or leave blank for any tour). Any other term will be used as a search value for tourcodesearch.`);
            return null;
        }
    }

    var sTourCodeName = null;
    switch(sCategoryName) {
        default: // Search case
            if (!searchTCArray) break;
            sTourCodeName = searchTCArray[Math.floor(Math.random() * searchTCArray.length)];
            break;
        case RandomTourCategory.Any:
            sTourCodeName = AllTourCodesNamesArray[Math.floor(Math.random() * AllTourCodesNamesArray.length)];
            break;
        case RandomTourCategory.Official:
            sTourCodeName = OfficialTourCodesNamesArray[Math.floor(Math.random() * OfficialTourCodesNamesArray.length)];
            break;
        case RandomTourCategory.Other:
            sTourCodeName = OtherTourCodesNamesArray[Math.floor(Math.random() * OtherTourCodesNamesArray.length)];
            break;
        case RandomTourCategory.Popular: {
                const weightsValues = Object.values(MashupsPopularRandomFormatsWeightsDictionary);
                const fWeightsSum = weightsValues.reduce((a, b) => a + b, 0);
                //console.log(`fWeightsSum: ${fWeightsSum}`);
                const fWeightThreshold = Math.random() * fWeightsSum;
                //console.log(`fWeightThreshold: ${fWeightThreshold}`);
                var fDeltaWeight = 0;
                var workDictionary = {...MashupsPopularRandomFormatsWeightsDictionary};
                while(true) {
                    //console.log(`fDeltaWeight: ${fDeltaWeight}`);
                    var keyArray = Object.keys(workDictionary);
                    //console.log(`keyArray: ${keyArray}`);
                    if(0 === keyArray.length) {
                        //console.log(`Stopped because dictionary was empty!`);
                        break;
                    }
                    if(1 === keyArray.length) {
                        sTourCodeName = keyArray[0];
                        //console.log(`Stopped with 1 left.`);
                        break;
                    }
                    var sPickKey = keyArray[Math.floor(Math.random() * keyArray.length)];
                    fDeltaWeight += workDictionary[sPickKey];
                    if(fDeltaWeight >= fWeightThreshold) {
                        sTourCodeName = sPickKey;
                        //console.log(`Stopped with multiple left.`);
                        break;
                    }
                    delete workDictionary[sPickKey];
                }
            }
            break;
    }
    //console.log(`sTourCodeName: ${sTourCodeName}`);

    if (!sTourCodeName) {
        commandContext.reply(`Failed to retrieve a valid tour code name for category: ${sCategoryName}!`);
        return null;
    }

    const sValidDynamicFormatKey = replyToSearchValidDynamicFormatKey(commandContext, sTourCodeName);
    if (!sValidDynamicFormatKey) {
        commandContext.reply(`Selected invalid tour code name: ${sTourCode}!`);
        return null;
    }

    return searchTourCode(sValidDynamicFormatKey);
}

//#endregion

//#region Tour Code Search

const SearchClauseSafetyLimit = 8;

var tryTourCodeSearch = exports.tryTourCodeSearch = function (commandContext, sSearch)
{
    //console.log(`start sSearch: ${sSearch}`);

    var intersectionsArray = sSearch.split(',');
    if(intersectionsArray.length > SearchClauseSafetyLimit) {
        commandContext.reply(`Too many clauses.`);
        return null;
    }

    var unionsArray;
    var nUnionItr;
    var intersectionResults = Object.keys(AllTourCodesDictionary);
    var unionResults;
    for(let nIntersectionItr=0; nIntersectionItr<intersectionsArray.length; ++nIntersectionItr) {
        unionsArray = intersectionsArray[nIntersectionItr].split('|');
        if(unionsArray.length > SearchClauseSafetyLimit) {
            commandContext.reply(`Too many clauses.`);
            return null;
        }

        // Unions
        unionResults = [];
        for(nUnionItr=0; nUnionItr<unionsArray.length; ++nUnionItr) {
            unionResults = unionResults.concat(trySearchTourCodeElement(unionsArray[nUnionItr], unionResults, intersectionsArray));
        }

        // Intersections
        intersectionResults = unionResults.filter(function(value) {
            return intersectionResults.includes(value);
        });
    }

    if (!intersectionResults || (0 === intersectionResults.length)) {
        commandContext.reply('No matches.');
        return;
    }

    return intersectionResults;
}

const RandomSearchKeywordsArray = ['random', 'randoms'];

var trySearchTourCodeElement = function (sSearch, unneededArray, ignoredArray)
{
    sSearch = sSearch.replace(/^\s+|\s+$/g, '');
    var bSearchIsRevoke = (sSearch && ('!' === sSearch[0]));
    sSearch = toId(sSearch);
    //console.log(`sSearch: ${sSearch}`);

    var resultsArray = [];

    var bSearchIsOfficial = ('official' == sSearch);
    var bSearchIsOther = !bSearchIsOfficial && ('other' == sSearch);
    var bSearchIsRandomKeyword = RandomSearchKeywordsArray.includes(sSearch);
    var sSearchAsAliasedFormatId = toId(Tools.parseAliases(sSearch));

    for (const [sKey, value] of Object.entries(DynamicFormatsRawDictionary)) {
        //console.log(`sKey: ${sKey}`);

        if (unneededArray && unneededArray.includes(sKey)) continue;
        if (ignoredArray && ignoredArray.includes(sKey)) continue;

        // official/other
        if (bSearchIsOfficial) {
            if (OfficialTourCodesNamesArray.includes(sKey)) {
                resultsArray.push(sKey);
                continue;
            }
        }
        else if (bSearchIsOther) {
            if (OtherTourCodesNamesArray.includes(sKey)) {
                resultsArray.push(sKey);
                continue;
            }
        }

        let datum = value;
        if (!datum) continue;

        // rulesArray
        let rulesArray = datum.rulesArray;
        if (rulesArray) {
            for (let sRule of rulesArray) {
                if (bSearchIsRevoke) {
                    if (sRule && ('!' === sRule[0])) { // Revoke comparison
                        if (toId(sRule) === sSearch) {
                            resultsArray.push(sKey);
                            break;
                        }
                    }
                }
                else if (toId(sRule) === sSearch) {
                    resultsArray.push(sKey);
                    break;
                }
            }
        }
        if (bSearchIsRevoke) continue;

        // tag
        const tagsArray = datum.tagsArray;
        if (tagsArray) {
            if (tagsArray.includes(sSearch)) {
                resultsArray.push(sKey);
                continue;
            }
        }

        // base format
        const baseFormatDetails = datum.baseFormatDetails;
        if (baseFormatDetails) {
            //console.log(`team: ${baseFormatDetails.team}`);
            //console.log(`mod: ${baseFormatDetails.mod}`);
            //console.log(`gameType: ${baseFormatDetails.gameType}`);

            // Random formats
            if (bSearchIsRandomKeyword) {
                if (baseFormatDetails.team) {
                    resultsArray.push(sKey);
                    continue;
                }
            }

            // team
            if (baseFormatDetails.team === sSearch) {
                resultsArray.push(sKey);
                continue;
            }

            // mod
            if (baseFormatDetails.mod === sSearch) {
                resultsArray.push(sKey);
                continue;
            }

            // gameType
            if (baseFormatDetails.gameType === sSearch) {
                resultsArray.push(sKey);
                continue;
            }

            // Base format name
            if (toId(baseFormatDetails.name) === sSearchAsAliasedFormatId) {
                resultsArray.push(sKey);
                continue;
            }
        }

        // Stacked format name
        const stackedFormatNamesArray = datum.stackedFormatNamesArray;
        if (stackedFormatNamesArray) {
            for (let sFormatName of stackedFormatNamesArray) {
                if (toId(sFormatName) === sSearchAsAliasedFormatId) {
                    resultsArray.push(sKey);
                    break;
                }
            }
        }
    }

    return resultsArray;
}

//#endregion

//#region Initialization

const INIT_FROM_CACHE = false;
//const INIT_FROM_CACHE = true;

var initTourCodeCache = exports.initTourCodeCache = function (room)
{
    initAliasData();

    if(INIT_FROM_CACHE) {
        tourCodeCacheFirstPhaseInit();
        tourCodeCacheSecondPhaseInit(room);
    }
    else {
        refreshTourCodeCache(room);
    }
}

var tourCodeCacheFirstPhaseInit = function()
{
    // List
    var listNames = fs.readFileSync('./data/' + LocalOTCMetadataPath + ListFName).toString();
    if( NotFoundErrorText !== listNames ) {
        AllTourCodesNamesArray = listNames.split(ListSeparator);
        AllTourCodesNamesArray = AllTourCodesNamesArray.map(function (sTour) {return sTour.trim();}); // Remove spaces
        AllTourCodesNamesArray = AllTourCodesNamesArray.sort(); // Make alphabetical
        AllTourCodesNamesArray = AllTourCodesNamesArray.filter((sName) => '' !== sName);
        for( var nItr=0; nItr<AllTourCodesNamesArray.length; ++nItr ) {
            AllTourCodesNamesArray[nItr] = toId(AllTourCodesNamesArray[nItr]);
            TourCodeURLsDictionary[AllTourCodesNamesArray[nItr]] = FormatsURLRoot + AllTourCodesNamesArray[nItr] + TourExt;
        }
    }

    // Officials
    var officialNames = fs.readFileSync('./data/' + LocalOTCMashupsPath + OfficialsFName).toString();
    if( NotFoundErrorText !== officialNames ) {
        OfficialTourCodesNamesArray = officialNames.split(ListSeparator);
        OfficialTourCodesNamesArray = OfficialTourCodesNamesArray.map(function (sTour) {return sTour.trim();}); // Remove spaces
        OfficialTourCodesNamesArray = OfficialTourCodesNamesArray.sort(); // Make alphabetical
        OfficialTourCodesNamesArray = OfficialTourCodesNamesArray.filter((sName) => '' !== sName);
        for( var nItr=0; nItr<OfficialTourCodesNamesArray.length; ++nItr ) {
            OfficialTourCodesNamesArray[nItr] = toId(OfficialTourCodesNamesArray[nItr]);
        }
    }

    // Others
    OtherTourCodesNamesArray = JSON.parse(JSON.stringify(AllTourCodesNamesArray));
    OtherTourCodesNamesArray = OtherTourCodesNamesArray.filter((sName) => !OfficialTourCodesNamesArray.includes(sName));

    // Dynamic Format Descriptions
    var dynamicFormatDescriptions = fs.readFileSync('./data/' + LocalOTCMetadataPath + DynamicFormatDescriptionsFName).toString();
    if( NotFoundErrorText !== dynamicFormatDescriptions ) {
        let contentArray = dynamicFormatDescriptions.split('\n');
        var nSubStringIdx;
        var bIsSplitTokenPresent;
        var sName;
        for(const sLine of contentArray) {
            if('' === sLine) continue;
            nSubStringIdx = sLine.indexOf(':');
            bIsSplitTokenPresent = (-1 !== nSubStringIdx);
            if(bIsSplitTokenPresent) {
                sName = toId(sLine.substring(0, nSubStringIdx));
                if(!AllTourCodesNamesArray.includes(sName)) {
                    console.log('Undefined format has description: ' + sName);
                }
                //console.log('Description key: ' + sName);
                //console.log('Description value: ' + sLine.substring(nSubStringIdx + 1));
                DynamicFormatDescriptionsDictionary[sName] = sLine.substring(nSubStringIdx + 1).replace(/^\s+|\s+$/g, '');
            }
        }
    }

    // Aliases
    var aliasesRaw = fs.readFileSync('./data/' + LocalOTCMetadataPath + AliasesFName).toString();
    if( NotFoundErrorText !== aliasesRaw ) {
        const contentArray = aliasesRaw.split('\n');
        var nSubStringIdx;
        var sValue;
        for(const sLine of contentArray) {
            if('' === sLine) continue;
            nSubStringIdx = sLine.indexOf(':');
            if(-1 !== nSubStringIdx) {
                sValue = toId(sLine.substring(0, nSubStringIdx)).replace(/^\s+|\s+$/g, '');
                //console.log('Alias value: ' + sValue);
                const keyContentArray = sLine.substring(nSubStringIdx + 1).split(',');
                keyContentArray.forEach( (alias) => {
                    AliasesDictionary[toId(alias)] = sValue;
                    //console.log('Alias value: ' + alias);
                });
            }
        }
    }

    // Spotlight Names
    var spotlightNames = fs.readFileSync('./data/' + LocalOTCMashupsPath + SpotlightNamesFName).toString();
    if( NotFoundErrorText !== spotlightNames ) {
        SpotlightNamesArray = spotlightNames.split(',');
        exports.SpotlightNamesArray = SpotlightNamesArray;
    }
    if (Mashups.setSpotlightTourNameArray) {
        Mashups.setSpotlightTourNameArray(SpotlightNamesArray);
    }

    // Daily Content
    var sDailyRawContentFName = './data/' + LocalOTCMashupsPath + DailyRawContentFName;
    var bExists = fs.existsSync(sDailyRawContentFName);
    if(!bExists) {
        console.log('Daily content missing: ' + sDailyRawContentFName);
    }
    DailyRawContent = fs.readFileSync(sDailyRawContentFName).toString();
    exports.DailyRawContent = DailyRawContent; // Reassignment necessary due to being reference type(?)
    //console.log('DailyRawContent: ' + DailyRawContent);
}

var tourCodeCacheSecondPhaseInit = function(room)
{
    // Formats
    for( var nItr=0; nItr<AllTourCodesNamesArray.length; ++nItr ) {
        var sLocalFName = './data/' + LocalOTCFormatsPath + AllTourCodesNamesArray[nItr] + TourExt;
        var bExists = fs.existsSync(sLocalFName);
        if(!bExists) {
            console.log('File missing: ' + sLocalFName);
            continue;
        }
        var sFileContent = fs.readFileSync(sLocalFName).toString();
        if( NotFoundErrorText === sFileContent ) {
            console.log('File 404: ' + sLocalFName);
            continue;
        }
        AllTourCodesDictionary[AllTourCodesNamesArray[nItr]] = sFileContent;
    }

    // Mashups Popular Random Formats
    var sMashupsPopularRandomFormatsFName = './data/' + LocalOTCMashupsPath + MashupsPopularRandomFormatsFName;
    bExists = fs.existsSync(sMashupsPopularRandomFormatsFName);
    if(!bExists) {
        console.log('Mashups Popular Random Formats metadata missing: ' + sMashupsPopularRandomFormatsFName);
    }
    var sMashupsPopularRandomFormatsRawContent = fs.readFileSync(sMashupsPopularRandomFormatsFName).toString();
    //console.log('sMashupsPopularRandomFormatsRawContent: ' + sMashupsPopularRandomFormatsRawContent);
    if( NotFoundErrorText !== sMashupsPopularRandomFormatsRawContent ) {
        MashupsPopularRandomFormatsWeightsDictionary = {};
        const contentArray = sMashupsPopularRandomFormatsRawContent.split('\n');
        var nSubStringIdx;
        var sValue;
        var sKey;
        for(const sLine of contentArray) {
            if('' === sLine) continue;

            nSubStringIdx = sLine.indexOf(':');
            if(-1 !== nSubStringIdx) {
                sKey = toId(sLine.substring(0, nSubStringIdx));
                sValue = Number(sLine.substring(nSubStringIdx + 1).split(','));
                if(0 === sValue) {
                    sValue = 1;
                }
            }
            else {
                sKey = sLine;
                sValue = 1;
            }
            sKey = sKey.replace(/^\s+|\s+$/g, '');

            if(!AllTourCodesNamesArray.includes(sKey) && ('spotlight' !== sKey)) {
                console.log('MashupsPopularRandomFormats had unrecognized format (ignored): ' + sKey);
                continue;
            }

            MashupsPopularRandomFormatsWeightsDictionary[sKey] = sValue;
        }
    }

    // Intermediate update
    if (room) {
        Bot.say(room, 'Rebuilding...');
    }

    // Rebuild dynamic formats raw cache
    DynamicFormatsRawDictionary = {};
    for (const [sKey, value] of Object.entries(AllTourCodesDictionary)) {
        DynamicFormatsRawDictionary[sKey] = generateDynamicFormatRaw(sKey);
    }

    // Rebuild daily content cached data
    DailyDayDictionary = {};
    SpotlightStartDate = null;

    var sDailyRawContent = DailyRawContent;
    var rawContentPerDayArray = sDailyRawContent.split('\n');
    var dayReferenceArray = [];
    var nDayReferenceIdx = 0;
    var splitArray, timeSplitArray, sTimeSlot, sDay, dHour, dTime, nDay, sFormatGroup;
    for (let sDayContent of rawContentPerDayArray) {
        sDayContent = sDayContent.replace(/ +(?= )/g,''); // Ensure the line of text is single-spaced
        //console.log(sDayContent);
        splitArray = sDayContent.split(':');
        sTimeSlot = splitArray[0];

        // Spotlight start special case
        if ('Spotlight Start' === sTimeSlot) {
            if (splitArray.length < 2) continue;

            SpotlightStartDate = new Date(splitArray[1].trim());
            continue;
        }

        if (splitArray.length > 1) {
            sFormatGroup = splitArray[1].trim();
            if('spotlight' === toId(sFormatGroup)) {
                sFormatGroup = `Spotlight (${SpotlightNamesArray[0]})`;
            }
            else {
                for(const name of SpotlightNamesArray) {
                    //console.log(name);
                    if(toId(sFormatGroup) !== toId(name)) continue;
                    sFormatGroup = `Free (would be ${name} if it wasn't spotlight)`;
                    break;
                }
            }
        }
        else {
            sFormatGroup = '';
        }
        timeSplitArray = sDayContent.split(',');
        sDay = timeSplitArray[0].trim();
        var nInitialHours = 0;
        if (timeSplitArray.length > 1) {
            //console.log("time Hour: " + timeSplitArray[1]);
            dHour = parseTime(timeSplitArray[1]);
            nInitialHours = parseHours(timeSplitArray[1]);
            //console.log("dHour: " + dHour);
        }
        else {
            dHour = new Date();
        }

        var nUTCHour = dHour.getUTCHours();
        var nDayOffset = (nInitialHours > 24) ? 1 : 0;
        var nDay = parseDay(sDay) + nDayOffset;
        //console.log("nUTCHour: " + nUTCHour);
        //console.log("nDay: " + nDay);

        DailyDayDictionary[sDay] = {
            day: nDay,
            dayOffset: nDayOffset,
            hour: nUTCHour,
            formatgroup: sFormatGroup
        };

        dayReferenceArray[nDayReferenceIdx] = DailyDayDictionary[sDay];
        nDayReferenceIdx++;
    }

    //console.log("DailyDayDictionary:");
    //console.log(DailyDayDictionary);

    DailyCycleDictionary = {};
    nDayReferenceIdx = 0;
    var nOffsetDayReferenceIdx = 0;
    for (var nCycleItr = 0; nCycleItr < 4; ++nCycleItr) {
        for (const sDayKey in DailyDayDictionary) {
            //console.log("nCycleItr: " + nCycleItr);
            //console.log("sDayKey: " + sDayKey);
            //console.log("nDayReferenceIdx: " + nDayReferenceIdx);
            nOffsetDayReferenceIdx = nDayReferenceIdx + nCycleItr;
            if (nOffsetDayReferenceIdx >= 7) {
                nOffsetDayReferenceIdx -= 7;

                if (nCycleItr > 0) {
                    nOffsetDayReferenceIdx++;
                }
            }
            //console.log("nOffsetDayReferenceIdx: " + nOffsetDayReferenceIdx);
            const timeReference = dayReferenceArray[nOffsetDayReferenceIdx];
            //console.log(timeReference);
            const sCycleKey = `${sDayKey} ${nCycleItr}`;
            DailyCycleDictionary[sCycleKey] = {
                day: (parseDay(sDayKey) + ('Sunday' === sDayKey ? 6 : -1)) + timeReference.dayOffset + (7*nCycleItr) + 1,
                hour: timeReference.hour,
                formatgroup: DailyDayDictionary[sDayKey].formatgroup
            };
            //console.log("sCycleKey: " + sCycleKey);
            //console.log(DailyCycleDictionary[sCycleKey]);

            nDayReferenceIdx++;
        }
        nDayReferenceIdx = 0;
    }

    //console.log("DailyCycleDictionary:");
    //console.log(DailyCycleDictionary);

    // Ensure there is a spotlight start fallback
    if (!SpotlightStartDate) {
        SpotlightStartDate = new Date(Date.now());
    }
    //console.log(SpotlightStartDate);

    exports.DailyDayDictionary = DailyDayDictionary;
    exports.DailyCycleDictionary = DailyCycleDictionary;
    exports.SpotlightStartDate = SpotlightStartDate;

    // Restart daily notification interval
    clearInterval(DailyCheckIntervalID);

    DailyCheckIntervalID = setInterval(DailyNotificationCallback, DailyNotificationCheckFrequencyMilliseconds);

    function DailyNotificationCallback()
    {
        var upcomingDailyData = calcUpcomingDailyData();
        if (!upcomingDailyData) return;

        if (upcomingDailyData.hoursLeft > 0) return;
        if (upcomingDailyData.minutesLeft > DailyNotificationBeginWarningFromRemainingMinutes) return;

        //console.log(CommandParser.cachedRoom);

        if (!CommandParser.cachedRoom) return;
        Bot.say(CommandParser.cachedRoom, `Scheduled daily: ${DailyCycleDictionary[upcomingDailyData.soonestDailyKey].formatgroup} upcoming in ${upcomingDailyData.minutesLeft} minutes...`);
    }

    // Output result
    if (room) {
        var sNames = nameCachedTourCodes();
        Bot.say(room, '!code Completed refresh.\n\n' + sNames);
    }
    console.log('TOUR CODE DATA READY');
}

var downloadFilePromise = exports.downloadFilePromise = function (url, file)
{
    let promise = new Promise(function(resolve, reject) {
        DataDownloader.downloadFile(
            url + "?" + Date.now(),
            file,
            function (s, err) {
                info('url: ' + url);
                info('dl completed');
                if (s) {
                    return resolve(file);
                }
                error("Data download failed: " + file + "\n" + err.message);
                errlog(err.stack);
                return reject(err);
            }
        );
    });
    return promise;
}

var bIsDoingRefresh = false;

var refreshTourCodeCache = exports.refreshTourCodeCache = async function (room)
{
    if(bIsDoingRefresh) return;

    clearInterval(DailyCheckIntervalID);

    bIsDoingRefresh = true;

    const listPromises = [
        // Metadata
        downloadFilePromise(
            ListURL,
            LocalOTCMetadataPath + ListFName),
        downloadFilePromise(
            DynamicFormatDescriptionsURL,
            LocalOTCMetadataPath + DynamicFormatDescriptionsFName),
        downloadFilePromise(
            AliasesURL,
            LocalOTCMetadataPath + AliasesFName),
        // Mashups
        downloadFilePromise(
            OfficialListURL,
            LocalOTCMashupsPath + OfficialsFName),
        downloadFilePromise(
            SpotlightNamesURL,
            LocalOTCMashupsPath + SpotlightNamesFName),
        downloadFilePromise(
            DailyRawContentURL,
            LocalOTCMashupsPath + DailyRawContentFName),
        downloadFilePromise(
            MashupsPopularRandomFormatsURL,
            LocalOTCMashupsPath + MashupsPopularRandomFormatsFName),
    ];

    allSettled(listPromises).
    then(
        (results) => {
            //results.forEach((result) => console.log(result.status));
            tourCodeCacheFirstPhaseInit();

            // Formats
            var formatPromises = [];
            for (let nItr=0; nItr<AllTourCodesNamesArray.length; ++nItr) {
                formatPromises.push(
                    downloadFilePromise(
                        TourCodeURLsDictionary[AllTourCodesNamesArray[nItr]],
                        LocalOTCFormatsPath + AllTourCodesNamesArray[nItr] + TourExt)
                );
            }

            allSettled(formatPromises).then(
                (tourResults) => {
                    //tourResults.forEach( (tourResult) => { console.log(tourResult.status); });
                    tourCodeCacheSecondPhaseInit(room);

                    bIsDoingRefresh = false;
                }
            );

            info(AllTourCodesNamesArray);
        }
    );
}

var updateFormatEntryFromCachedFile = function (sKey, sLocalPath)
{
    const sLocalFName = './data/' + sLocalPath + sKey + TourExt;
    const bExists = fs.existsSync(sLocalFName);
    if (!bExists) {
        console.log('File missing: ' + sLocalFName);
        return;
    }
    const sFileContent = fs.readFileSync(sLocalFName).toString();
    if (NotFoundErrorText === sFileContent) {
        console.log('File 404: ' + sLocalFName);
        return;
    }
    AllTourCodesDictionary[sKey] = sFileContent;
}

var refreshSingleFormatCache = exports.refreshSingleFormatCache = async function (sSearchFormat, room)
{
    if (bIsDoingRefresh) return;

    const sKey = searchValidDynamicFormatKey(sSearchFormat);
    if (!sKey) return;

    bIsDoingRefresh = true;

    const bIsOfficial = (OfficialTourCodesNamesArray.includes(sKey));
    const sLocalPath = bIsOfficial ? LocalOTCOfficialPath : LocalOTCOtherPath;
    const refreshPromise = downloadFilePromise(
        TourCodeURLsDictionary[sKey],
        sLocalPath + sKey + TourExt);
    refreshPromise.then(
        (refreshResult) => {
            console.log(refreshResult);

            // Update cached data
            updateFormatEntryFromCachedFile(sKey, sLocalPath);
            DynamicFormatsRawDictionary[sKey] = generateDynamicFormatRaw(sKey);

            // Output result
            if (room) {
                Bot.say(room, `!code Refreshed ${sKey}!\n${AllTourCodesDictionary[sKey]}`);
            }

            bIsDoingRefresh = false;
        }
    );
}

//#endregion

//#region Octokit

const TEST_OCTOKIT_NO_PR = false;
//const TEST_OCTOKIT_NO_PR = true;

const TEST_OCTOKIT_SANDBOX_REPOSITORY = false;
//const TEST_OCTOKIT_SANDBOX_REPOSITORY = true;

const MyOctokit = Octokit.plugin(createPullRequest);

const octokit = new MyOctokit({
  auth: Config.github.secret,
});

var requestWriteTourCode = exports.requestWriteTourCode = function (
    commandContext,
    arg,
    user,
    room,
    bHasDirectWriteAccess)
{
    if (bIsDoingRefresh) {
        commandContext.reply(`Already waiting on update!`);
        return;
    }

    requestWriteTourCodeAsync(commandContext, arg, user, room, bHasDirectWriteAccess);
}

var requestWriteTourCodeAsync = async function (
    commandContext,
    arg,
    user,
    room,
    bHasDirectWriteAccess)
{
    if (bIsDoingRefresh) return;

    // Start locking out other updates until we complete
    bIsDoingRefresh = true;

    const params = arg.split('|');
    if (3 !== params.length) {
        bIsDoingRefresh = false;
        commandContext.reply(`Usage: !code ?write [key]|[comment]|[tour code]`);
        return;
    }

    const sSearchKey = toId(params[0].trim());
    var sKey = searchValidDynamicFormatKey(sSearchKey);
    const bIsExistingTour = !!sKey;
    if (!bIsExistingTour) {
        sKey = sSearchKey;
    }

    const sComment = params[1].trim();
    if ('' === sComment) {
        bIsDoingRefresh = false;
        commandContext.reply(`Comment cannot be empty!`);
        return;
    }

    const sTourCode = params[2].trim();
    if ('' === sTourCode) {
        bIsDoingRefresh = false;
        commandContext.reply(`Tour code cannot be empty!`);
        return;
    }
    if (!sTourCode.includes('\n')) {
        bIsDoingRefresh = false;
        commandContext.reply(`Tour code was only one line! (Missing !code prefix?)`);
        return;
    }

    // Validate tour code
    const sBackupExistingTC = bIsExistingTour ? AllTourCodesDictionary[sKey] : null;

    var bTCValid = true;

    AllTourCodesDictionary[sKey] = sTourCode;
    const dynamicFormatRaw = generateDynamicFormatRaw(sKey);
    if (!dynamicFormatRaw) {
        bTCValid = false;
        commandContext.reply(`Failed to validate tour code content! (May involve non-existent formats, etc)`);
    } else if (!dynamicFormatRaw.name || (TourNameMissingFallback === dynamicFormatRaw.name)) {
        bTCValid = false;
        commandContext.reply(`Tour code has no name!`);
    } else if (!bIsExistingTour) {
        const nTourIDGeneration = Mashups.determineFormatIDGen(sKey);
        const nTourCodeGeneration = Mashups.determineFormatGen(dynamicFormatRaw.baseFormatDetails);

        if (Mashups.c_nUndefinedGen === nTourIDGeneration) {
            bTCValid = false;
            commandContext.reply(`Tour key has invalid generation!`);
        } else if (nTourIDGeneration !== nTourCodeGeneration) {
            bTCValid = false;
            commandContext.reply(`The generations of the tour key (${nTourIDGeneration}) and tour code (${nTourCodeGeneration}) do not match!`);
        }
    }

    // Revert local overwrite
    if (!bHasDirectWriteAccess || !bTCValid) {
        if (bIsExistingTour) {
            AllTourCodesDictionary[sKey] = sBackupExistingTC;
        } else {
            delete AllTourCodesDictionary[sKey];
        }
    }

    if (!bTCValid) {
        bIsDoingRefresh = false;

        return;
    }

    // Confirm local overwrite
    if (!INIT_FROM_CACHE && bHasDirectWriteAccess) {
        DynamicFormatsRawDictionary[sKey] = dynamicFormatRaw;
    }

    //console.log(`name: ${dynamicFormatRaw.name}`);
    //console.log(`baseFormatDetails: ${dynamicFormatRaw.baseFormatDetails}`);
    //console.log(dynamicFormatRaw.baseFormatDetails);

    var bPRRequestSucceeded = true;
    try {
        await writeTourCodeCreatePRAsync(
            commandContext,
            sKey,
            bIsExistingTour,
            sTourCode,
            sComment,
            user,
            room,
            bHasDirectWriteAccess);
    } catch (err) {
        commandContext.reply(`Failed update: ${err}`);
        bPRRequestSucceeded = false;
    }

    if (!bPRRequestSucceeded) {
        if (bIsExistingTour) {
            AllTourCodesDictionary[sKey] = sBackupExistingTC;
        } else {
            delete AllTourCodesDictionary[sKey];
        }
    }

    bIsDoingRefresh = false;
}

var writeTourCodeCreatePRAsync = async function (
    commandContext,
    sKey,
    bIsExistingTour,
    sTourCode,
    sComment,
    user,
    room,
    bHasDirectWriteAccess)
{
    const sUserId = toId(user);

    const nNowTimestamp = Date.now();
    const dNow = new Date(nNowTimestamp);

    const sRepo =  TEST_OCTOKIT_SANDBOX_REPOSITORY ? `OTC_SandboxMirror` : `OperationTourCode`; // Seems like it needs to use this instead of 'OTC' for now
    const sBaseBranchName = `master`;
    const sHeadBranchName = `${sUserId}-${sKey}-${nNowTimestamp}`;
    const sTourCodePath = `formats/${sKey}${TourExt}`;

    const changedFilesDict = {};
    changedFilesDict[sTourCodePath] = sTourCode;
    if (!bIsExistingTour) {
        const allTourCodesKeyArray = Object.keys(AllTourCodesDictionary);
        if (!bHasDirectWriteAccess) { // Without write access, the key should have been deleted locally
            allTourCodesKeyArray.push(sKey);
        }
        changedFilesDict[`metadata/list.txt`] = allTourCodesKeyArray.sort().join('\n');
    }

    const sOverwriteStatus = bHasDirectWriteAccess ? `Overwrote local tour code` : `Local tour code unchanged`;

    if (TEST_OCTOKIT_NO_PR) {
        Bot.say(room, `!code Skipped creating PR at : https://github.com/OperationTourCode/${sRepo}/pull/(Number) (${sOverwriteStatus})

Comment: ${sComment}

Path: ${sTourCodePath}

TourCode: ${sTourCode}

List: ${bIsExistingTour ? '(Unchanged)' : changedFilesDict[`metadata/list.txt`]}`);
        return;
    }

    //console.log(`Trying to create PR at https://github.com/OperationTourCode/${sRepo}/`);

    const sIdentifiedComment = `(${user}) ${sKey}: ${sComment}`;

    // Escape @ in user rank so that GitHub doesn't consider it a link to a GH account name
    // \ doesn't work: https://github.com/github/markup/issues/1168
    const sSanitizedUsername = user.replace(`@`, `@<!-- -->`);

    octokit
    .createPullRequest({
        owner: `OperationTourCode`,
        repo: sRepo,
        title: sIdentifiedComment,
        body: `${sSanitizedUsername}: "${sComment}"\n\nCreated via Iolanthe on ${dNow.toUTCString()}.`,
        base: sBaseBranchName, /* optional: defaults to default branch */
        head: sHeadBranchName,
        forceFork: true, /* optional: force creating fork even when user has write rights */
        changes: [
            {
                /* optional: if `files` is not passed, an empty commit is created instead */
                files: changedFilesDict,
                commit: sIdentifiedComment,
            },
        ],
    })
    .then((pr) => {
        console.log(pr.data.number);
        commandContext.reply(`Created PR: https://github.com/OperationTourCode/${sRepo}/pull/${pr.data.number} (${sOverwriteStatus})`);
    })
    .catch((err) => {
        commandContext.reply(`Failed update: ${err}`);
    });
}

//#endregion

var nameCachedTourCodes = exports.nameCachedTourCodes = function ()
{
    const currentGenPrefixRegex = new RegExp(`^${Mashups.getCurrentGenName()}`);
    const genPrefixRegex = new RegExp(`^gen([1-9]|[1-9][0-9])`);
    const displayOverrideInputArray = Object.keys(DisplayOverrideFormatIDDict);

    const currentGenOfficialsArray = [];
    const currentGenOthersArray = [];
    const oldGenOfficialsArray = [];
    const oldGenOthersArray = [];

    for (var nItr=0; nItr<AllTourCodesNamesArray.length; ++nItr) {
        const sTourKey = AllTourCodesNamesArray[nItr];
        const sGenStrippedTourKey = sTourKey.replace(genPrefixRegex, '');
        const bIsCurrentGen = currentGenPrefixRegex.test(sTourKey);
        const bIsOfficial = OfficialTourCodesNamesArray.includes(sTourKey);

        var sDisplayContent = sTourKey;
        if (bIsCurrentGen) { // When displaying, strip gen from current-gen keys
            sDisplayContent = sDisplayContent.replace(currentGenPrefixRegex, '');
        }
        if (displayOverrideInputArray.includes(sGenStrippedTourKey)) { // Use common aliases if they are exact matches
            for (const sDisplayOverrideInput of displayOverrideInputArray) {
                sDisplayContent = sDisplayContent.replace(sDisplayOverrideInput, DisplayOverrideFormatIDDict[sDisplayOverrideInput]);
            }
        }

        if (bIsCurrentGen) {
            if (bIsOfficial) {
                currentGenOfficialsArray.push(sDisplayContent);
            } else {
                currentGenOthersArray.push(sDisplayContent);
            }
        } else {
            if (bIsOfficial) {
                oldGenOfficialsArray.push(sDisplayContent);
            } else {
                oldGenOthersArray.push(sDisplayContent);
            }
        }

        // Sanity check that displayed strings actually alias properly
        //console.assert(!!searchValidDynamicFormatKey(sDisplayContent), `${sDisplayContent} failed as a look-up (sTourKey: ${sTourKey})`);
    }

    var sOutput = '';
    sOutput = concatTourCodeDisplayCategory(sOutput, 'Officials', currentGenOfficialsArray, true);
    sOutput = concatTourCodeDisplayCategory(sOutput, 'Others', currentGenOthersArray, true);
    sOutput = concatTourCodeDisplayCategory(sOutput, 'Old-gen Officials', oldGenOfficialsArray, true);
    sOutput = concatTourCodeDisplayCategory(sOutput, 'Old-gen Others', oldGenOthersArray, true);
    sOutput = concatTourCodeDisplayCategory(sOutput, 'Spotlight names', SpotlightNamesArray, false);

    return sOutput;
}

var concatTourCodeDisplayCategory = function (
    sOutput,
    sHeader,
    namesArray,
    bPostfixLineBreak)
{
    if (sHeader) {
        sOutput += `${sHeader}: `;
    }

    var bFirstLoop = true;
    for (var nItr=0; nItr<namesArray.length; ++nItr) {
        if (!bFirstLoop) {
            sOutput += ', ';
        }
        sOutput += namesArray[nItr];
        bFirstLoop = false;
    }

    if (bPostfixLineBreak) {
        sOutput += '\n\n';
    }

    return sOutput;
}

var toDynamicFormatKey = function (sSearch)
{
    sSearch = sSearch.replace(' ', '');
    sSearch = toId(sSearch);
    return sSearch;
}

var searchValidDynamicFormatKeyInternal = function (sSearch)
{
    sSearch = toDynamicFormatKey(sSearch);

    if('spotlight' === sSearch) {
        // Spotlight special case: search for tour code name in SpotlightNamesArray
        for(let name of SpotlightNamesArray) {
            //console.log(name);
            if(!AllTourCodesDictionary.hasOwnProperty(toDynamicFormatKey(name))) continue;
            sSearch = toDynamicFormatKey(name);
            break;
        }
    }

    if(!AllTourCodesDictionary.hasOwnProperty(sSearch)) {
        // Try to automatically recognize current-gen tour names without the gen explicitly specified
        if('gen' !== sSearch.substring(0, 3)) {
            sSearch = Mashups.getCurrentGenName() + sSearch;
            if(!AllTourCodesDictionary.hasOwnProperty(sSearch)) {
                return null;
            }
        }
        else {
            return null;
        }
    }

    return sSearch;
}

var searchValidDynamicFormatKey = function (sSearch)
{
    // Prefer using the raw value over alias searching if we can
    const sRawSearch = searchValidDynamicFormatKeyInternal(sSearch);
    if(sRawSearch) return sRawSearch;

    // Aliased search
    const sAliasedSearch = resolveAlias(sSearch);
    if(sAliasedSearch === sSearch) return null; // No point in repeating internal seach if alias doesn't change anything
    return searchValidDynamicFormatKeyInternal(sAliasedSearch);
}

const DirectFormatIDAliasDict = Object.freeze(sortByKeyLength({
    '1v1':      [],
    '350':      ['350cup'],
    'aaa':      ['almostanyability'],
    'abc':      ['alphabetcup'],
    'ag':       ['anythinggoes'],
    'aag':      ['almostanythinggoes'],
    'bdsp':     [],
    'bh':       ['balancedhackmons'],
    'broken':   ['brokencup'],
    'bt':       ['bonustype'],
    'builtin':  ['lcotm'],
    'camo':     ['camomons'],
    'camove':   [],
    'cap':      [],
    'cc':       ['challengecup'],
    'ce':       ['crossevolution'],
    'chaos':    ['chaos'],
    'chimera':  ['chimera1v1'],
    'converge': ['convergence'],
    'cs':       ['categoryswap'],
    'doubles':  [],
    'flipped':  [],
    'forte':    ['fortemons'],
    'fotf':     ['forceofthefallen'],
    'fp':       ['fullpotential'],
    'gg':       ['godlygift'],
    'inh':      ['inheritance'],
    'linked':   [],
    'lc':       ['littlecup'],
    'lg':       ['losersgame'],
    'mayhem':   [],
    'mono':     ['monotype'],
    'mnm':      ['mixandmega'],
    'nd':       ['natdex', 'nationaldex'],
    'nfe':      ['notfullyevolved'],
    'ns':       ['natureswap'],
    'nu':       ['neverused'],
    'pic':      ['partnersincrime'],
    'poke':     ['pokebilities'],
    'ph':       ['purehackmons'],
    'pu':       [],
    'randbats': [],
    'randbtas': ['randbatsmayhem', 'randbtasmayhem'],
    'reevo':    ['reevolution'],
    'rev':      ['revelation'],
    'ru':       ['rarelyused'],
    'scale':    ['scalemons'],
    'sketch':   ['sketchmons'],
    'sp':       ['sharedpower'],
    'stab':     ['stabmons'],
    'ssb':      ['superstaffbros'],
    'ts':       ['tiershift'],
    'ubers':    [],
    'uu':       ['underused'],
    'zu':       ['zeroused'],
}));

const CombinedFormatIDAliasDict = Object.freeze(sortByKeyLength({
    'caaamo':       ['camo', 'aaa'],
    'caaamomons':   ['camo', 'aaa'],
    'snm':          ['stab', 'mnm'],
    'stabnmega':    ['mnm', 'stab'],
    'staaab':       ['stab', 'aaa'],
    'staaabmons':   ['stab', 'aaa'],
}));

var DisplayOverrideFormatIDDict = {};

var initAliasData = function () {
    // Allow reverse searching from the shortest combined ID to prefered alias
    for (const sCombKey of Object.keys(CombinedFormatIDAliasDict)) {
        const sJoinedIDArray = CombinedFormatIDAliasDict[sCombKey].join('');
        if (DisplayOverrideFormatIDDict.hasOwnProperty(sJoinedIDArray) &&
            (sCombKey.length > DisplayOverrideFormatIDDict[sJoinedIDArray].length)) continue;

        DisplayOverrideFormatIDDict[sJoinedIDArray] = sCombKey;
    }

    //console.log(CombinedFormatIDAliasDict);
    //console.log(DisplayOverrideFormatIDDict);
}

var resolveAlias = exports.resolveAlias = function (sSearch)
{
    // Alias search should be case-insensitive, etc
    sSearch = toId(sSearch);

    // Direct alias reference case
    if (AliasesDictionary.hasOwnProperty(sSearch)) {
        return AliasesDictionary[sSearch];
    }

    if (sSearch.length < 4) return sSearch; // Cannot check gen safely

    // Try to find valid alias by stripping away potentially anomalous current-gen prefixes
    if (Mashups.getCurrentGenName() === sSearch.substring(0, 4)) {
        const sGenStrippedSearch = sSearch.substring(4);
        if (AliasesDictionary.hasOwnProperty(sGenStrippedSearch)) {
            return AliasesDictionary[sGenStrippedSearch];
        }
    }

    if (sSearch.length > 30) return sSearch; // Too expensive for dynamic aliasing

    // Try to dealias dynamically by testing different permutations of input
    var sGenPrefix;
    var sDynamicSearch;
    if ('gen' === sSearch.substring(0, 3)) {
        sGenPrefix = sSearch.substring(0, 4);
        sDynamicSearch = sSearch.substring(4);
    } else {
        sGenPrefix = Mashups.getCurrentGenName();
        sDynamicSearch = sSearch;
    }

    var bDynamicSearchSucceeded = false;

    const targetFormatIDArray = [];

    //console.log('sGenPrefix: ' + sGenPrefix);
    //console.log('sDynamicSearch: ' + sDynamicSearch);

    // Combined format dynamic aliasing
    for (const sCombKey of Object.keys(CombinedFormatIDAliasDict)) {
        //console.log(sCombKey);

        if (!sDynamicSearch.includes(sCombKey)) continue;
        if (targetFormatIDArray.includes(sCombKey)) continue;

        sDynamicSearch = sDynamicSearch.replace(sCombKey, '');
        for (const sCombValue of CombinedFormatIDAliasDict[sCombKey]) {
            targetFormatIDArray.push(sCombValue);
        }

        if (0 === sDynamicSearch.length) {
            bDynamicSearchSucceeded = true;
            break;
        }
    }

    for (const sDirectKey of Object.keys(DirectFormatIDAliasDict)) {
        // Search format ID aliases first (usually longer)
        for (const sDirectValue of DirectFormatIDAliasDict[sDirectKey]) {
            if (!sDynamicSearch.includes(sDirectValue)) continue;
            if (targetFormatIDArray.includes(sDirectValue)) continue;

            sDynamicSearch = sDynamicSearch.replace(sDirectValue, '');
            targetFormatIDArray.push(sDirectValue);

            if (0 === sDynamicSearch.length) {
                bDynamicSearchSucceeded = true;
                break;
            }
        }
        if (bDynamicSearchSucceeded) break;

        // Search format ID key
        if (!sDynamicSearch.includes(sDirectKey)) continue;
        if (targetFormatIDArray.includes(sDirectKey)) continue;

        //console.log(`found sDirectKey: ${sDirectKey}`);
        sDynamicSearch = sDynamicSearch.replace(sDirectKey, '');
        targetFormatIDArray.push(sDirectKey);
        //console.log(`sDynamicSearch: ${sDynamicSearch}`);

        if (0 === sDynamicSearch.length) {
            bDynamicSearchSucceeded = true;
            break;
        }
    }
    if (!bDynamicSearchSucceeded) return sSearch;

    //console.log(`checking perms: ${targetFormatIDArray}`);

    const sInitialJoin = sGenPrefix + targetFormatIDArray.join('');
    //console.log(`sInitialJoin: ${sInitialJoin}`);
    if (AllTourCodesDictionary.hasOwnProperty(sInitialJoin)) {
        return sInitialJoin;
    }

    var nIDCount = targetFormatIDArray.length,
    workIDArray = new Array(nIDCount).fill(0),
    nIDItr = 1, nIDNextItr, sIDNext;

    while (nIDItr < nIDCount) {
        if (workIDArray[nIDItr] < nIDItr) {
            nIDNextItr = nIDItr % 2 && workIDArray[nIDItr];
            sIDNext = targetFormatIDArray[nIDItr];
            targetFormatIDArray[nIDItr] = targetFormatIDArray[nIDNextItr];
            targetFormatIDArray[nIDNextItr] = sIDNext;
            ++workIDArray[nIDItr];
            nIDItr = 1;
            const sJoin = sGenPrefix + targetFormatIDArray.join('');
            //console.log(`sJoin: ${sJoin}`);
            if (AllTourCodesDictionary.hasOwnProperty(sJoin)) {
                return sJoin;
            }
        } else {
            workIDArray[nIDItr] = 0;
            ++nIDItr;
        }
    }

    return sSearch;
}

var searchTourCode = exports.searchTourCode = function (sSearch)
{
    sSearch = searchValidDynamicFormatKey(sSearch);
    if (!sSearch) return null;

    return AllTourCodesDictionary[sSearch];
}

var searchDynamicFormatRaw = exports.searchDynamicFormatRaw = function (sSearch)
{
    sSearch = searchValidDynamicFormatKey(sSearch);
    if (!sSearch) return null;

    return DynamicFormatsRawDictionary[sSearch];
}

var replyToSearchValidDynamicFormatKey = exports.replyToSearchValidDynamicFormatKey = function (commandContext, sSearch)
{
    var result = searchValidDynamicFormatKey(sSearch);
    //commandContext.reply(`result: ` + result);
    if(!result) {
        if('spotlight' === toId(sSearch)) {
            commandContext.reply(`Could not find tour code matching spotlight names metadata.`);
        }
        else {
            commandContext.reply(`Could not find tour code data for format: ` + sSearch);
        }
        return null;
    }
    return result;
}

var searchTourCodeURL = exports.searchTourCodeURL = function(sSearch)
{
    sSearch = searchValidDynamicFormatKey(sSearch);
    if (!sSearch) return null;

    if (!TourCodeURLsDictionary.hasOwnProperty(sSearch)) return null;
    return TourCodeURLsDictionary[sSearch];
}

//#region generateMashupFormats
if (!String.format) {
    String.format = function(format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) { 
        return typeof args[number] != 'undefined'
            ? args[number] 
            : match
        ;
        });
    };
}

if (!String.periodicJoin) {
    String.periodicJoin = function(array, regularSeparator, period, periodicSeparator) {
        var sOutput = '';
        if(!array || (0 == array.length)) return sOutput;
        var nPeriodicCounter = 1;
        var sSeparator;
        for(var nItr=0; nItr<array.length-1; ++nItr) {
            if(nPeriodicCounter >= period) {
                sSeparator = periodicSeparator;
                nPeriodicCounter = 0;
            }
            else {
                sSeparator = regularSeparator;
            }
            ++nPeriodicCounter;
            sOutput += array[nItr] + sSeparator;
        }
        sOutput += array[array.length-1];
        return sOutput;
    };
}

var addTrashChannelRulesForFormat = function (rulesArray, formatName) {
    formatName = Mashups.getFormatKey(formatName);
    if(null === formatName) return rulesArray;

    formatName = Mashups.genStripName(formatName);

    switch(formatName) {
        case 'mixandmega':
            rulesArray.push('Mix and Mega Standard Package');
            break;
    }

    return rulesArray;
}

var formatRulesList = function (array) {
    array = array.map(sItem => sItem.replace(`'`, `\\'`));
    // Human-generated format data rules by convention end with a trailing comma
    return `'` + String.periodicJoin(array, `', '`, 8, `',\n\t\t\t'`) + `',`;
}

var formatRulesArrayForDispay = exports.formatRulesArrayForDispay = function (array) {
    return array.join(`, `);
}

var unpackPokemonFormesInGOArray = function (sourceArray) {
    if(!sourceArray || (sourceArray.length < 1)) return sourceArray;

    sourceArray = [...new Set(sourceArray)]; // Remove any duplicates

    var priorityDict = {};

    var filterOutFormes = new Set();
    var correctedInFormes = new Set();
    var nPriority;
    var sCorrectedName;
    for(const sGO of sourceArray) {
        let pokemonGO = Mashups.getGameObjectAsPokemon(sGO);
        if(!pokemonGO) continue;

        let bIsBaseForme = !(pokemonGO.baseSpecies);
        let bReferencesAllFormes = bIsBaseForme && (Mashups.getGameObjectAsPokemonRaw(sGO) === pokemonGO);
        if(bReferencesAllFormes) {
            //console.log("Ref all formes: " + sGO);
            nPriority = 1;
            if(pokemonGO.otherFormes) {
                for(const sForme of pokemonGO.otherFormes) {
                    sCorrectedName = sForme;
                    correctedInFormes.add(sForme);
                    if(priorityDict && 
                        (!(sCorrectedName in priorityDict) 
                            || (priorityDict[sCorrectedName] > nPriority))) {
                        priorityDict[sCorrectedName] = nPriority;
                    }
                }
                sCorrectedName = pokemonGO.name + '-Base';
                correctedInFormes.add(sCorrectedName);
                if(priorityDict && 
                    (!(sCorrectedName in priorityDict) 
                        || (priorityDict[sCorrectedName] > nPriority))) {
                    priorityDict[sCorrectedName] = nPriority;
                }
            }
            else {
                sCorrectedName = pokemonGO.name.toString();
                correctedInFormes.add(sCorrectedName);
                if(priorityDict) {
                    priorityDict[sCorrectedName] = nPriority;
                }
            }
        }
        else {
            //console.log("Ref specific forme: " + sGO);
            nPriority = 0;
            if(bIsBaseForme) {
                sCorrectedName = pokemonGO.name + '-Base';
            }
            else {
                sCorrectedName = pokemonGO.name;
            }
            correctedInFormes.add(sCorrectedName);
            if(priorityDict) {
                priorityDict[sCorrectedName] = nPriority;
            }
        }

        filterOutFormes.add(sGO);
    }

    sourceArray = sourceArray.filter(function(value, index, arr) {
        return !filterOutFormes.has(value);
    });

    /*console.log("filterOutFormes:");
    console.log(filterOutFormes);

    console.log("correctedInFormes:");
    console.log(correctedInFormes);

    console.log("priorityDict:");
    console.log(priorityDict);*/

    return { array: sourceArray.concat(...correctedInFormes), dict: priorityDict };
}

var filterPokemonFormeArrayByPriority = function (targetArray, targetPriorityDict, ...filterPriorityDictArray) {
    return targetArray.filter(function(value, index, arr) {
        if(Mashups.isGameObjectPokemon(value) && !(value in targetPriorityDict)) { // Should be impossible
            console.log("Key missing from priority dict: " + value);
            return false;
        }

        for(const filterDict of filterPriorityDictArray) {
            if(value in filterDict) {
                if(filterDict[value] < targetPriorityDict[value]) {
                    return false;
                }
            }
        }

        return true;
    });
}

var packPokemonFormesInGOArray = function (sourceArray) {
    if(!sourceArray || (sourceArray.length < 1)) return sourceArray;

    sourceArray = [...new Set(sourceArray)]; // Remove any duplicates

    var filterOutFormes = new Set();
    var correctedInFormes = new Set();
    var bAllFormesInArray;
    for(const sGO of sourceArray) {
        let goAllFormesArray = Mashups.getAllPokemonFormesArray(sGO);
        if(!goAllFormesArray) continue;

        bAllFormesInArray = true;
        for(const forme of goAllFormesArray) {
            let pokemonForme = Mashups.getGameObjectAsPokemon(forme);
            if(!pokemonForme) continue;

            if(!pokemonForme.baseSpecies) {
                if(sourceArray.includes(pokemonForme.name + '-Base')) continue;
            }
            else {
                if(sourceArray.includes(pokemonForme.name)) continue;
            }
            bAllFormesInArray = false;
        }

        if(bAllFormesInArray) {
            goAllFormesArray.forEach(function callback(value) {  
                filterOutFormes.add(value);
            });
            let basePokemonGO = Mashups.getGameObjectAsPokemonBaseForme(sGO);
            if(basePokemonGO) {
                correctedInFormes.add(basePokemonGO.name);
            }
        }
    }

    /*console.log("filterOutFormes 2:");
    console.log(filterOutFormes);

    console.log("correctedInFormes 2:");
    console.log(correctedInFormes);*/

    sourceArray = sourceArray.filter(function(value, index, arr) {
        return !filterOutFormes.has(value);
    });

    return sourceArray.concat(...correctedInFormes);
}

var standarizeGameObjectArrayContent = function (sourceArray) {
    sourceArray = packPokemonFormesInGOArray(sourceArray);

    if(!sourceArray || (sourceArray.length < 2)) return sourceArray;

    sourceArray = [...new Set(sourceArray)]; // Remove any duplicates

    var pokemonGOArray = [];
    var abilitiesGOArray = [];
    var itemsGOArray = [];
    var movesGOArray = [];
    var othersGOArray = [];
    for(const sGO of sourceArray) {
        if(Mashups.isGameObjectPokemon(sGO)) {
            pokemonGOArray.push(sGO);
            continue;
        }
        if(Mashups.isGameObjectAbility(sGO)) {
            abilitiesGOArray.push(sGO);
            continue;
        }
        if(Mashups.isGameObjectItem(sGO)) {
            itemsGOArray.push(sGO);
            continue;
        }
        if(Mashups.isGameObjectMove(sGO)) {
            movesGOArray.push(sGO);
            continue;
        }
        othersGOArray.push(sGO);
    }

    pokemonGOArray.sort();
    abilitiesGOArray.sort();
    itemsGOArray.sort();
    movesGOArray.sort();
    othersGOArray.sort();

    return othersGOArray
        .concat(pokemonGOArray)
        .concat(abilitiesGOArray)
        .concat(itemsGOArray)
        .concat(movesGOArray);
}

var generateDynamicFormatRaw = exports.generateDynamicFormatRaw = function(sTourCodeKey, bWriteFallbacks=true) {
    if(!AllTourCodesDictionary.hasOwnProperty(toId(sTourCodeKey))) return false;

    var nRuleItr;

    let sTourCode = searchTourCode(sTourCodeKey);
    if(!sTourCode) return false;

    // Determine format name, base format, etc from tour code
    let lineArray = sTourCode.split('\n');
    let sTourNameLine = null;
    let sBaseFormatLine = null;
    let sDeltaRulesLine = null;
    let baseFormatLineArray = null;
    let sInlineTourName = null;
    lineArray.forEach(function(sLine) {
        if(!sLine) return;
        sLine = sLine.replace(/ +(?= )/g,''); // Ensure the line of text is single-spaced
        //console.log(sLine);
        if(!sTourNameLine && sLine.startsWith(TourNameLinePrefix)) {
            sTourNameLine = sLine;
        }
        if(!sBaseFormatLine && 
            (sLine.startsWith(TourBaseFormatNewLinePrefix) ||
            sLine.startsWith(TourBaseFormatCreateLinePrefix) ||
            sLine.startsWith(TourBaseFormatStartTourLinePrefix))) {
            if(sLine.includes(TourInlineNameSeparator)) {
                baseFormatLineArray = sLine.split(TourInlineNameSeparator);
                sBaseFormatLine = baseFormatLineArray[0].replace(/^\s+|\s+$/g, '');
                sInlineTourName = baseFormatLineArray[1].replace(/^\s+|\s+$/g, '');
            }
            else {
                sBaseFormatLine = sLine;
            }
        }
        if(!sDeltaRulesLine && sLine.startsWith(TourDeltaRulesLinePrefix)) {
            sDeltaRulesLine = sLine;
        }
    });

    let sTourName = '';
    if(sTourNameLine) { // Prioritize name from dedicated line
        sTourName = sTourNameLine.substr(TourNameLinePrefix.length);
    }
    else if(sInlineTourName) { // Support inline names
        sTourName = sInlineTourName;
    }
    else { // Fallback in case name is missing
        if (bWriteFallbacks) {
            sTourName = TourNameMissingFallback;
        }
        console.log(`sTourCodeKey: ${sTourCodeKey}: Tour name missing!`);
    }

    let sBaseFormatName = '';
    if(!sBaseFormatLine) { // Fallback in case base format is missing
        if (bWriteFallbacks) {
            sBaseFormatName = TourBaseFormatMissingFallback;
        }
        console.log(`sTourCodeKey: ${sTourCodeKey}: Tour base format missing!`);
    }
    else { // Accurate base format name
        if(sBaseFormatLine.includes(TourBaseFormatNewLinePrefix)) {
            sBaseFormatName = sBaseFormatLine.substr(TourBaseFormatNewLinePrefix.length);
        }
        else if(sBaseFormatLine.includes(TourBaseFormatCreateLinePrefix)) {
            sBaseFormatName = sBaseFormatLine.substr(TourBaseFormatCreateLinePrefix.length);
        }
        else if(sBaseFormatLine.includes(TourBaseFormatStartTourLinePrefix)) {
            sBaseFormatName = sBaseFormatLine.substr(TourBaseFormatStartTourLinePrefix.length);
        }
        sBaseFormatName = sBaseFormatName.split(',')[0];
    }

    // Acquire delta rules
    let deltaRulesArray = [];
    if(sDeltaRulesLine) { // We don't necessarily expect rule changes
        let sDeltaRules = sDeltaRulesLine.substr(TourDeltaRulesLinePrefix.length);;
        deltaRulesArray = sDeltaRules.split(',');
        for(nRuleItr=0; nRuleItr<deltaRulesArray.length; ++nRuleItr) {
            deltaRulesArray[nRuleItr] = deltaRulesArray[nRuleItr].replace(/^\s+|\s+$/g, ''); // Remove any trailing/leading spaces from every rule
            deltaRulesArray[nRuleItr] = deltaRulesArray[nRuleItr].replace('-base', '-Base'); // Deal with poorly-represented bans
        }
    }
    // Filter out empty rules (trailing comma, etc)
    deltaRulesArray = deltaRulesArray.filter(function(value, index, arr) {
        return ('' !== value);
    });

    // Unpack any format-stacking rules
    var filterOutFormatStackingDeltaRules = new Set();
    var unpackedFormatStackingDeltaRules = new Set();
    for(const sRule of deltaRulesArray) {
        let format = Mashups.findFormatDetails(sRule);
        if(!format) continue; // Not format-stacking

        // Allow format-stacking for tier-defining formats
        // 21/02/13: Seems like we need to unpack these as well
        //if(Mashups.isFormatTierDefinition(sRule)) continue;

        if(format.banlist) {
            format.banlist.forEach(function callback(value) {  
                unpackedFormatStackingDeltaRules.add('-'+value);
            });
        }

        if(format.unbanlist) {
            format.unbanlist.forEach(function callback(value) {  
                unpackedFormatStackingDeltaRules.add('+'+value);
            });
        }

        if(format.restricted) {
            format.restricted.forEach(function callback(value) {  
                unpackedFormatStackingDeltaRules.add('*'+value);
            });
        }

        if(format.ruleset) { // FIXME: Probably need to clean up after
            format.ruleset.forEach(function callback(value) {  
                unpackedFormatStackingDeltaRules.add(value);
            });
        }

        filterOutFormatStackingDeltaRules.add(sRule);
    }
    deltaRulesArray = deltaRulesArray.filter(function(value, index, arr) {
        return !filterOutFormatStackingDeltaRules.has(value);
    });
    deltaRulesArray = deltaRulesArray.concat(...unpackedFormatStackingDeltaRules);
    // Add Trash Channel rules defining common methods for stacked formats
    for(const sStackedFormat of filterOutFormatStackingDeltaRules) {
        deltaRulesArray = addTrashChannelRulesForFormat(deltaRulesArray, sStackedFormat);
    }

    // Acquire base format data
    let baseFormatDetails = Mashups.findFormatDetails(sBaseFormatName);
    if(!baseFormatDetails) {
        console.log(`sTourCodeKey: ${sTourCodeKey}: Could not retrieve details for format: ${sBaseFormatName}`);
        return false;
    }

    var sDescription = DynamicFormatDescriptionsDictionary.hasOwnProperty(sTourCodeKey) ?
        DynamicFormatDescriptionsDictionary[sTourCodeKey] :
        null;

    // Analyze base format rules
    var baseFormatRulesArray = [];
    var baseFormatRepealsArray = [];
    if(baseFormatDetails.ruleset) {
        let baseFormatRuleset = baseFormatDetails.ruleset;
        for(nRuleItr=0; nRuleItr<baseFormatRuleset.length; ++nRuleItr) {
            let sDeltaRule = baseFormatRuleset[nRuleItr];
            let sLeadingChar = sDeltaRule.substr(0, 1);
            let sRemainingChars = sDeltaRule.substr(1);
            switch(sLeadingChar) {
                case '!':
                    baseFormatRepealsArray.push(sRemainingChars);
                    break;
                default:
                    baseFormatRulesArray.push(sDeltaRule);
                    break;
            }
        }
    }
    // Add Trash Channel rules defining common methods for base format
    baseFormatRulesArray = addTrashChannelRulesForFormat(baseFormatRulesArray, baseFormatDetails.name);

    var baseFormatBansArray = [];
    if(baseFormatDetails.banlist) {
        baseFormatBansArray = baseFormatDetails.banlist;
    }
    var baseFormatUnbansArray = [];
    if(baseFormatDetails.unbanlist) {
        baseFormatUnbansArray = baseFormatDetails.unbanlist;
    }
    var baseFormatRestrictedArray = [];
    if(baseFormatDetails.restricted) {
        baseFormatRestrictedArray = baseFormatDetails.restricted;
    }
    baseFormatBansArray = unpackPokemonFormesInGOArray(baseFormatBansArray).array || [];
    baseFormatUnbansArray = unpackPokemonFormesInGOArray(baseFormatUnbansArray).array || [];
    baseFormatRestrictedArray = unpackPokemonFormesInGOArray(baseFormatRestrictedArray).array || [];

    // Rule modifications
    var deltaRulesetArray = [];
    var deltaRepealsArray = [];
    var deltaBansArray = [];
    var deltaUnbansArray = [];
    var deltaRestrictedArray = [];
    for(nRuleItr=0; nRuleItr<deltaRulesArray.length; ++nRuleItr) {
        let sDeltaRule = deltaRulesArray[nRuleItr];
        let sLeadingChar = sDeltaRule.substr(0, 1);
        let sRemainingChars = sDeltaRule.substr(1);
        switch(sLeadingChar) {
            case '+':
                deltaUnbansArray.push(sRemainingChars);
                break;
            case '-':
                deltaBansArray.push(sRemainingChars);
                break;
            case '!':
                deltaRepealsArray.push(sRemainingChars);
                break;
            case '*':
                deltaRestrictedArray.push(sRemainingChars);
                break;
            default:
                deltaRulesetArray.push(sDeltaRule);
                break;
        }
    }
    var deltaBansRes = unpackPokemonFormesInGOArray(deltaBansArray);
    deltaBansArray = deltaBansRes.array || [];
    var deltaBansPriorityDict = deltaBansRes.dict || {};
    var deltaUnbansRes = unpackPokemonFormesInGOArray(deltaUnbansArray);
    deltaUnbansArray = deltaUnbansRes.array || [];
    var deltaUnbansPriorityDict = deltaUnbansRes.dict || {};
    var deltaRestrictedRes = unpackPokemonFormesInGOArray(deltaRestrictedArray);
    deltaRestrictedArray = deltaRestrictedRes.array || [];
    var deltaRestrictionsPriorityDict = deltaRestrictedRes.dict || {};

    deltaBansArray = filterPokemonFormeArrayByPriority(
        deltaBansArray,
        deltaBansPriorityDict,
        deltaUnbansPriorityDict,
        deltaRestrictionsPriorityDict);
    deltaUnbansArray = filterPokemonFormeArrayByPriority(
        deltaUnbansArray,
        deltaUnbansPriorityDict,
        deltaBansPriorityDict,
        deltaRestrictionsPriorityDict);
    deltaRestrictedArray = filterPokemonFormeArrayByPriority(
        deltaRestrictedArray,
        deltaRestrictionsPriorityDict,
        deltaBansPriorityDict,
        deltaUnbansPriorityDict);

    // ruleset
    var combinedRulesArray = baseFormatRulesArray.concat(deltaRulesetArray);
    var combinedRepealsArray = baseFormatRepealsArray.concat(deltaRepealsArray);
    combinedRepealsArray = combinedRepealsArray.filter(function(value, index, arr) {
        return !deltaRulesetArray.includes(value);
    });
    combinedRulesArray = combinedRulesArray.filter(function(value, index, arr) {
        return !combinedRepealsArray.includes(value);
    });
    // Remove any duplicates
    combinedRulesArray = [...new Set(combinedRulesArray)];
    combinedRepealsArray = [...new Set(combinedRepealsArray)];
    // Re-format rules
    combinedRepealsArray = combinedRepealsArray.map(sItem => '!' + sItem);
    combinedRulesArray = combinedRulesArray.concat(combinedRepealsArray);

    // Determine implicit bans and restrictions (those included inside rules)
    // If an implicit ban also exists in the banlist, it will crash the validator, so we need to filter these out
    var implicitBansArray = [];
    var implicitUnbansArray = [];
    var implicitRestrictedArray = [];
    for(const sRule of combinedRulesArray) {
        let format = Mashups.findFormatDetails(sRule);
        if(format) { // FIXME: This logic is too simple and can't account for rebans, etc but for now...
            if (format.banlist) {
                implicitBansArray = implicitBansArray.concat(format.banlist);
            }
            if (format.unbanlist) {
                implicitUnbansArray = implicitUnbansArray.concat(format.unbanlist);
            }
            if (format.restricted) {
                implicitRestrictedArray = implicitRestrictedArray.concat(format.restricted);
            }
        }
        // FIXME: For complete coverage, we also need to look at rules as these can also include bans, etc but there seems to be no good way to access these yet
    }

    // Determine tier basis for unbans
    var nMinTierIncluded = Mashups.Tier.Undefined;
    for(const sRule of combinedRulesArray) {
        let nRuleTierId = Mashups.determineFormatDefinitionTierId(sRule);
        if(nRuleTierId > nMinTierIncluded) {
            nMinTierIncluded = nRuleTierId;
        }
    }

    // banlist
    var combinedBansArray = baseFormatBansArray.concat(deltaBansArray);
    combinedBansArray = combinedBansArray.filter(function(value, index, arr) {
        return !deltaUnbansArray.includes(value)
            && !deltaRestrictedArray.includes(value)
            && !implicitBansArray.includes(value);
    });
    combinedBansArray = standarizeGameObjectArrayContent(combinedBansArray);

    // unbanlist
    var combinedUnbansArray = baseFormatUnbansArray.concat(deltaUnbansArray);
    combinedUnbansArray = combinedUnbansArray.filter(function(value, index, arr) {
        return !deltaBansArray.includes(value)
            && !deltaRestrictedArray.includes(value)
            && !implicitUnbansArray.includes(value);
    });
    // Filter out unbans that are redundant due to not being included through a tiered format
    // Do before standardization so the formes are split (may be tiered separately)
    combinedUnbansArray = combinedUnbansArray.filter(function(value, index, arr) {
        let pokemonForme = Mashups.getGameObjectAsPokemon(value);
        if(!pokemonForme) return true;

        let nPokemonTier = Mashups.calcPokemonTier(pokemonForme);
        //console.log("Checking unban of forme: "+value+" nPokemonTier: "+nPokemonTier.toString()+" nMinTierIncluded: "+nMinTierIncluded.toString());
        return nPokemonTier < nMinTierIncluded;
    });
    combinedUnbansArray = standarizeGameObjectArrayContent(combinedUnbansArray);

    // restricted
    var combinedRestrictedArray = baseFormatRestrictedArray.concat(deltaRestrictedArray);
    combinedRestrictedArray = combinedRestrictedArray.filter(function(value, index, arr) {
        return !deltaBansArray.includes(value)
            && !deltaUnbansArray.includes(value)
            && !implicitRestrictedArray.includes(value);
    });
    combinedRestrictedArray = standarizeGameObjectArrayContent(combinedRestrictedArray);

    // Create tags array
    var tagsArray = [];
    const formatIDKeysArray = Object.keys(DirectFormatIDAliasDict);
    var sTagSearchRemainder = Mashups.genStripName(sTourCodeKey);
    var bTagSearchComplete = false;
    var bMadeTagSearchReplacementLoop = false;
    do {
        bMadeTagSearchReplacementLoop = false;
        for (const sIDKey of formatIDKeysArray) {
            if (tagsArray.includes(sIDKey)) continue;
            if (!sTagSearchRemainder.startsWith(sIDKey)) continue;

            tagsArray.push(sIDKey);
            sTagSearchRemainder = sTagSearchRemainder.replace(sIDKey, '');

            if (0 == sTagSearchRemainder.length) {
                bTagSearchComplete = true;
            }
            bMadeTagSearchReplacementLoop = true;
            break;
        }
    } while (bMadeTagSearchReplacementLoop && !bTagSearchComplete);

    return {
        name: sTourName,
        baseFormatDetails: baseFormatDetails,
        description: sDescription,
        rulesArray: combinedRulesArray,
        bansArray: combinedBansArray,
        unbansArray: combinedUnbansArray,
        restrictedArray: combinedRestrictedArray,
        stackedFormatNamesArray: filterOutFormatStackingDeltaRules,
        tagsArray: tagsArray,
    };
}

var generateDynamicFormat = function(sTourCodeKey, sArrayTemplate, sFormatTemplate, sThreadTemplate) {
    const formatRaw = generateDynamicFormatRaw(sTourCodeKey);
    if (!formatRaw) {
        console.log('Could not retrieve formatRaw for sTourCodeKey: ' + sTourCodeKey);
        return false;
    }

    // format name
    var sFormatName = formatRaw.name;

    var baseFormatDetails = formatRaw.baseFormatDetails;

    // description
    var sDescriptionOutput = formatRaw.description ?
        formatRaw.description :
        TourDescriptionMissingFallback;
    sDescriptionOutput = sDescriptionOutput.replace('Pokemon', 'Pok&eacute;mon'); // Format for html

    // threads
    let combinedThreadsArray = [];
    if(baseFormatDetails.threads) {
        // Base format vanilla threads
        combinedThreadsArray = combinedThreadsArray.concat(baseFormatDetails.threads);
        combinedThreadsArray = combinedThreadsArray.map(sItem => sItem.replace(`">`, `">Vanilla `));
    }
    // Mashup generic resources
    let sGenericThread = String.format(sThreadTemplate,
        GenericResourcesLink, // {0}
        sFormatName+" Resources" // {1}
    );
    combinedThreadsArray.unshift(sGenericThread);
    // Combined threads
    var sThreadOutput = '`' + combinedThreadsArray.join('`,\n\t\t\t`') + '`';

    // mod
    var sModOutput = '';
    if(!baseFormatDetails.mod) {
        sModOutput = TourBaseFormatModMissingFallback;
        console.log('Tour base format has no mod specified!');
    }
    else {
        sModOutput = baseFormatDetails.mod;
    }

    // Pre-rules supplementary output
    var sSingleItemFormatPropertyTemplate = `\n\t\t{0}: {1},`;
    var sPrerulesSupplementaryOutput = '';
    if(baseFormatDetails.gameType) {
        sPrerulesSupplementaryOutput += String.format(sSingleItemFormatPropertyTemplate, 'gameType', `'` + baseFormatDetails.gameType + `'`);
    }
    if(baseFormatDetails.maxLevel) {
        sPrerulesSupplementaryOutput += String.format(sSingleItemFormatPropertyTemplate, 'maxLevel', baseFormatDetails.maxLevel.toString());
    }

    // ruleset
    var sRulesetOutput = formatRulesList(formatRaw.rulesArray);

    // banlist
    var sBanlistOutput = formatRulesList(formatRaw.bansArray);

    // unbanlist
    var sUnbanListOutput = (formatRaw.unbansArray.length > 0) ? formatRulesList(formatRaw.unbansArray) : null;

    // restricted
    var sRestrictedListOutput = (formatRaw.restrictedArray.length > 0) ? formatRulesList(formatRaw.restrictedArray) : null;

    // Late supplementary output
    var sLateSupplementaryOutput = '';
    if(sUnbanListOutput) {
        sLateSupplementaryOutput += String.format(sArrayTemplate, 'unbanlist', sUnbanListOutput);
    }
    if(sRestrictedListOutput) {
        sLateSupplementaryOutput += String.format(sArrayTemplate, 'restricted', sRestrictedListOutput);
    }

    var sFormatOutput = String.format(sFormatTemplate,
        sFormatName, // {0}
        sDescriptionOutput, // {1}
        sThreadOutput, // {2}
        sModOutput, // {3}
        sPrerulesSupplementaryOutput, // {4}
        sRulesetOutput, // {5}
        sBanlistOutput, // {6}
        sLateSupplementaryOutput, // {7}
    );

    return sFormatOutput;
}

var generateFormatsFromArray = function(sHeaderName, formatsArray, sArrayTemplate, sFormatTemplate, sThreadTemplate, sSectionHeaderTemplate) {
    var sRawOutput = '';
    if(formatsArray.length > 0) {
        formatsArray.sort();
        sRawOutput += String.format(sSectionHeaderTemplate, sHeaderName, MashupsGeneratedFormatsColumn);
        for(var sTourName of formatsArray) {
            sRawOutput += generateDynamicFormat(sTourName, sArrayTemplate, sFormatTemplate, sThreadTemplate);
            sRawOutput += '\n';
        }
    }

    return sRawOutput;
}

var generateMashupFormats = exports.generateMashupFormats = function () {
    if(!fs.existsSync(ArrayTemplatePath)) {
        console.log('File missing: ' + ArrayTemplatePath);
        return false;
    }
    var sArrayTemplate = fs.readFileSync(ArrayTemplatePath).toString();

    if(!fs.existsSync(CommentHeaderTemplatePath)) {
        console.log('File missing: ' + CommentHeaderTemplatePath);
        return false;
    }
    var sCommentHeaderTemplate = fs.readFileSync(CommentHeaderTemplatePath).toString();

    if(!fs.existsSync(FormatTemplatePath)) {
        console.log('File missing: ' + FormatTemplatePath);
        return false;
    }
    var sFormatTemplate = fs.readFileSync(FormatTemplatePath).toString();

    if(!fs.existsSync(FormatListTemplatePath)) {
        console.log('File missing: ' + FormatListTemplatePath);
        return false;
    }
    var sFormatListTemplate = fs.readFileSync(FormatListTemplatePath).toString();

    if(!fs.existsSync(SectionHeaderTemplatePath)) {
        console.log('File missing: ' + SectionHeaderTemplatePath);
        return false;
    }
    var sSectionHeaderTemplate = fs.readFileSync(SectionHeaderTemplatePath).toString();

    if(!fs.existsSync(ThreadTemplatePath)) {
        console.log('File missing: ' + ThreadTemplatePath);
        return false;
    }
    var sThreadTemplate = fs.readFileSync(ThreadTemplatePath).toString();

    var sRawOutput = '';

    // Place spotlight first in list, if it is well-defined
    var sSpotlightKeyName = null;
    for(const name of SpotlightNamesArray) {
        if(!AllTourCodesDictionary.hasOwnProperty(toId(name))) continue;
        sSpotlightKeyName = toId(name);
        break;
    }
    if(sSpotlightKeyName) {
        sRawOutput += String.format(sCommentHeaderTemplate, 'Mashups Spotlight');
        sRawOutput += String.format(sSectionHeaderTemplate, 'Mashups Spotlight', MashupsGeneratedFormatsColumn);
        sRawOutput += generateDynamicFormat(sSpotlightKeyName, sArrayTemplate, sFormatTemplate, sThreadTemplate);
        sRawOutput += '\n';
    }

    // Formats removed from output entirely (test, temporary or gimmick metas, etc)
    const ignoredFormatsArray = [
        'gen8dppstaaab',
        'gen8staaabbl',
        'gen8staaabtiers',
        'gen8staaabtrial',
        'gen8staaabru',
        'gen8staaabpredlc',
        'gen8staaabubers',
        'gen8aaadoublestrial'
    ];

    // Official mashup formats
    var nonSpotlightOfficialsArray = OfficialTourCodesNamesArray.filter(function(value, index, arr) {
        if (ignoredFormatsArray.includes(value)) return false;
        return (value !== sSpotlightKeyName);
    });
    var doublesOfficialsArray = nonSpotlightOfficialsArray.filter(function(value, index, arr) {
        return value.includes('doubles');
    });
    var littleCupOfficialsArray = nonSpotlightOfficialsArray.filter(function(value, index, arr) {
        return value.includes('littlecup');
    });
    var singlesOfficialsArray = nonSpotlightOfficialsArray.filter(function(value, index, arr) {
        return !doublesOfficialsArray.includes(value) && !littleCupOfficialsArray.includes(value);
    });

    // Officials comment header
    sRawOutput += String.format(sCommentHeaderTemplate, 'Official OM Mashups');

    // Officials format lists
    sRawOutput += generateFormatsFromArray('Official OM Mashups (Singles)', singlesOfficialsArray, sArrayTemplate, sFormatTemplate, sThreadTemplate, sSectionHeaderTemplate);
    sRawOutput += generateFormatsFromArray('Official OM Mashups (Doubles)', doublesOfficialsArray, sArrayTemplate, sFormatTemplate, sThreadTemplate, sSectionHeaderTemplate);
    sRawOutput += generateFormatsFromArray('Official OM Mashups (Little Cup)', littleCupOfficialsArray, sArrayTemplate, sFormatTemplate, sThreadTemplate, sSectionHeaderTemplate);

    // Section to test specific tour codes
    /*
    let sTestTourCodeName = 'gen8staaabmons';
    //let sTestTourCodeName = 'gen8tsaaa';
    //let sTestTourCodeName = 'gen8camomonsdoubles';

    sRawOutput += generateDynamicFormat(sTestTourCodeName, sArrayTemplate, sFormatTemplate, sThreadTemplate);
    sRawOutput += '\n';
    */

    // Remove trailing line return
    sRawOutput = sRawOutput.replace(/\n$/, "")

    // Format into list
    sRawOutput = String.format(sFormatListTemplate, sRawOutput);

    var outputFPath = Config.overrideGeneratedMashupsFormatsOutputDirectory ?
        Config.overrideGeneratedMashupsFormatsOutputDirectory + GenMashupFormatsFName :
        MashupFormatsOutputPath;

    var bFileWriteFailed = false;
    fs.writeFile(outputFPath, sRawOutput, function (err2) {
        if (err2) {
            console.log('Output failed: ' + outputFPath);
            bFileWriteFailed = true;
        }
    });
    if(bFileWriteFailed) return false;

    return true;
}

//#endregion generateMashupFormats

//#region Daily Content

var parseHours = exports.parseHours = function (timeString) {	
	if (timeString == '') return null;
	
	var time = timeString.match(/(\d+)(:(\d\d))?\s*(p?)/i);
	if (time == null) return null;
	
	var hours = parseInt(time[1],10);
	if (hours == 12 && !time[4]) {
		hours = 0;
	}
	else { // Need to support hours outside UMT day span (>12PM)
		hours += (time[4])? 12 : 0;
	}
	return hours;
}

var parseTime = exports.parseTime = function (timeString) {	
	if (timeString == '') return null;
	
	var time = timeString.match(/(\d+)(:(\d\d))?\s*(p?)/i);
	if (time == null) return null;
	
	var hours = parseInt(time[1],10);
	if (hours == 12 && !time[4]) {
		hours = 0;
	}
	else { // Need to support hours outside UMT day span (>12PM)
		hours += (time[4])? 12 : 0;
	}
    //console.log("time[4]: " + time[4]);
    //console.log("hours: " + hours);
	var d = new Date();
	d.setUTCHours(hours);
	d.setMinutes(parseInt(time[3],10) || 0);
	d.setSeconds(0, 0);
	return d;
}

var parseDay = exports.parseDay = function (sDayString) {
	if (sDayString == '') return -1;
    
    var nDay = -1;
    switch(sDayString) {
        case 'Sunday': nDay = 0; break;
        case 'Monday': nDay = 1; break;
        case 'Tuesday': nDay = 2; break;
        case 'Wednesday': nDay = 3; break;
        case 'Thursday': nDay = 4; break;
        case 'Friday': nDay = 5; break;
        case 'Saturday': nDay = 6; break;
    }
    return nDay;
}

var dateDiff = exports.dateDiff = function (dFirst, dSecond) {        
    return Math.round((dSecond - dFirst) / (1000 * 60 * 60 * 24));
}

var addDays = exports.addDays = function (dDate, nDeltaDays) {
    var result = new Date(dDate);
    result.setDate(result.getDate() + nDeltaDays);
    return result;
}

var convertDateToUTC = exports.convertDateToUTC = function (dDate) {
    return new Date(
        dDate.getUTCFullYear(),
        dDate.getUTCMonth(),
        dDate.getUTCDate(),
        dDate.getUTCHours(),
        dDate.getUTCMinutes(),
        dDate.getUTCSeconds());
}

var calcUpcomingDailyData = exports.calcUpcomingDailyData = function() {
    var dNow = new Date(Date.now());
    // Test
    //dNow = new Date(Date.now() + (1000*60*60*(7+0*24)));
    var nCurrentDay = dNow.getUTCDay();
    console.log("dNow: " + dNow);
    //console.log("nCurrentDay: " + nCurrentDay);

    //const nDaysSinceStartOfSpotlight = dateDiff(SpotlightStartDate, dNow);
    //console.log("nDaysSinceStartOfSpotlight: " + nDaysSinceStartOfSpotlight);

    const nTimeSinceStartOfSpotlight = dNow - SpotlightStartDate;
    console.log("nTimeSinceStartOfSpotlight: " + nTimeSinceStartOfSpotlight);

    var sSoonestDailyKey = null, nSoonestDailyDeltaTime;
    var dTestDate, nDeltaDays, nDeltaTime;
    /*for (let key in DailyDayDictionary) {
        nDeltaDays = (DailyDayDictionary[key].day < nCurrentDay) ? (7 - nCurrentDay) + DailyDayDictionary[key].day : DailyDayDictionary[key].day - nCurrentDay;
        dTestDate = addDays(dNow, nDeltaDays);
        dTestDate.setUTCHours(DailyDayDictionary[key].hour);
        dTestDate.setUTCMinutes(0);
        dTestDate.setUTCSeconds(0);
        nDeltaTime = dTestDate - dNow;

        let bIsDeltaTimePositive = (nDeltaTime > 0);
        if (!bIsDeltaTimePositive) continue;

        if (!sSoonestDailyKey || (nSoonestDailyDeltaTime > nDeltaTime)) {
            sSoonestDailyKey = key;
            nSoonestDailyDeltaTime = nDeltaTime;
        }
    }*/
    console.log(DailyCycleDictionary);
    for (let key in DailyCycleDictionary) {
        dTestDate = addDays(SpotlightStartDate, DailyCycleDictionary[key].day);
        dTestDate.setUTCHours(DailyCycleDictionary[key].hour);
        dTestDate.setUTCMinutes(0);
        dTestDate.setUTCSeconds(0);
        nDeltaTime = dTestDate - dNow;

        let bIsDeltaTimePositive = (nDeltaTime > 0);
        if (!bIsDeltaTimePositive) continue;

        if (!sSoonestDailyKey || (nSoonestDailyDeltaTime > nDeltaTime)) {
            sSoonestDailyKey = key;
            nSoonestDailyDeltaTime = nDeltaTime;

            console.log("Test sSoonestDailyKey: " + sSoonestDailyKey);
            console.log("Test nSoonestDailyDeltaTime: " + nSoonestDailyDeltaTime);
        }
    }

    if (!sSoonestDailyKey) return null;

    console.log("sSoonestDailyKey: " + sSoonestDailyKey);
    var nSeconds = Math.floor(nSoonestDailyDeltaTime/1000);
    var nMinutes = Math.floor(nSeconds/60);
    var nHours = Math.floor(nMinutes/60);
    var nDays = Math.floor(nHours/24);
    console.log("nSeconds: " + nSeconds);
    console.log("nMinutes: " + nMinutes);
    console.log("nHours: " + nHours);
    console.log("nDays: " + nDays);

    //nHours = nHours-(nDays*24);
    nMinutes = nMinutes/*-(nDays*24*60)*/-(nHours*60);

    return {
        soonestDailyKey: sSoonestDailyKey,
        hoursLeft: nHours,
        minutesLeft: nMinutes,
    };
}

//#endregion Daily Content