// ==UserScript==
// @name         Squishy Timecard
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Collapse direct time entries on timecard into summarized clusters
// @author       Ken Nall @kennenal (MDW7) 
// @match        https://fclm-portal.amazon.com/employee/timeDetails*
// @grant        none
// @downloadURL  https://axzile.corp.amazon.com/-/carthamus/download_script/squishy-timecard.user.js
// @updateURL    https://axzile.corp.amazon.com/-/carthamus/download_script/squishy-timecard.user.js
// ==/UserScript==

(function() {
    'use strict';

    function parseTime(timeStr) {
        const [mins, secs] = timeStr.split(':').map(Number);
        return mins * 60 + secs;
    }

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function calculateWidth(totalSeconds) {
        // Based on ratio: 33m22s (2002 seconds) = 2.3287037037037037%
        const referenceSeconds = 2002;
        const referenceWidth = 2.3287037037037037;
        return (totalSeconds / referenceSeconds) * referenceWidth;
    }

    function collapseDirectTime() {
        const rows = document.querySelectorAll('tr.function-seg.direct');
        if (rows.length === 0) return;

        let clusters = [];
        let currentCluster = [];

        rows.forEach((row, index) => {
            if (currentCluster.length === 0) {
                currentCluster.push(row);
            } else {
                const prevRow = currentCluster[currentCluster.length - 1];
                const prevNext = prevRow.nextElementSibling;
                
                if (prevNext === row) {
                    currentCluster.push(row);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [row];
                }
            }
        });
        
        if (currentCluster.length > 0) {
            clusters.push(currentCluster);
        }

        clusters.forEach(cluster => {
            if (cluster.length <= 1) return;

            const firstRow = cluster[0];
            const lastRow = cluster[cluster.length - 1];

            const titles = new Set();
            let totalSeconds = 0;

            cluster.forEach(row => {
                const titleCell = row.querySelector('td[colspan="2"]');
                if (titleCell) {
                    titles.add(titleCell.textContent.trim());
                }
                const timeCell = row.querySelector('td.rightAlign');
                if (timeCell) {
                    totalSeconds += parseTime(timeCell.textContent.trim());
                }
            });

            const startTime = firstRow.querySelectorAll('td')[2].textContent.trim();
            const endTime = lastRow.querySelectorAll('td')[3].textContent.trim();
            const formattedTime = formatTime(totalSeconds);
            const newWidth = calculateWidth(totalSeconds);

            const titleCell = firstRow.querySelector('td[colspan="2"]');
            const titleArray = Array.from(titles);
            titleCell.textContent = titleArray[0];
            titleCell.title = titleArray.join('\n');
            titleCell.style.cursor = 'help';
            firstRow.querySelectorAll('td')[2].textContent = startTime;
            firstRow.querySelectorAll('td')[3].textContent = endTime;
            firstRow.querySelector('td.rightAlign').textContent = formattedTime;
            
            // Adjust the time-segment width
            const timeSegment = firstRow.querySelector('.time-segment');
            if (timeSegment) {
                timeSegment.style.width = `${newWidth}%`;
            }

            for (let i = 1; i < cluster.length; i++) {
                cluster[i].remove();
            }
        });
    }

    collapseDirectTime();
})();