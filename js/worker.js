'use strict';
importScripts('math.js', 'catalog.js', 'calculation.js');

self.onmessage = ({ data }) => {
  self.postMessage({ id: data.id, result: calculate(data) });
};
