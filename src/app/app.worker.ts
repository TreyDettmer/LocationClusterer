/// <reference lib="webworker" />

import { KMeans, setBackend } from 'scikitjs';
import * as tf from '@tensorflow/tfjs'
import { Status, WorkerResponse } from './interfaces/worker-response';

/**
 * Gets distance in miles between two points on earth.
 * @param {number[]} origin
 * @param {number[]} destination
 */
function distance(origin : any, destination : any) : number
{
  let lat1 = origin[0];
  let lon1 = origin[1];
  let lat2 = destination[0];
  let lon2 = destination[1]

  let radius = 6371 // km
  let dlat = (lat2-lat1) * Math.PI/180.0
  let dlon = (lon2-lon1) * Math.PI/180.0
  let a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1 * Math.PI/180.0) * Math.cos(lat2 * Math.PI/180.0) * Math.sin(dlon/2) * Math.sin(dlon/2)

  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  let d = radius * c;
  // convert to miles
  d *=  0.621371;
  return d;
}


function createClusters(numberOfClusters : number, points : any) : any
{
  let kmeans = new KMeans({nClusters:numberOfClusters,randomState:0}).fit(points);
  let labels = kmeans.predict(points).arraySync();
  //let uniqueLabelCount = new Set(labels).size;
  let clusters = new Array(numberOfClusters);
  for (let i = 0; i < clusters.length; i++)
  {
    clusters[i] = [];
  }
  //console.log("unique labels " + uniqueLabelCount);

  for (let row = 0; row < points.length; row++)
  {
    let clusterIndex = labels[row];
    try
    {
      
      clusters[clusterIndex].push(points[row]);
      points[row].push(clusterIndex); 
    }
    catch (error)
    {
      console.error(error);
      console.log(`ClusterIndex: ${clusterIndex} clusters.length: ${clusters.length} points[row]: ${points[row]}`);
      throw "error";
    }

  }
  return [clusters,points];
  
}


function validateSolution(clusters : any, maxDistance : number) : boolean
{
  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++)
  {

    if (!validateCluster(clusters[clusterIndex],maxDistance))
    {
      return false;
    }

  }
  return true;
}

function validateCluster(cluster : any, maxDistance : number) : boolean
{

  for (let originIndex = 0; originIndex < cluster.length;originIndex++)
  {
    for (let destinationIndex = originIndex + 1; destinationIndex < cluster.length; destinationIndex++)
    {
      if (distance(cluster[originIndex],cluster[destinationIndex]) > maxDistance)
      {
        return false;
      }
    }
  }
  return true;
}

function FindValidClusters(points : any, clusters : any, minimumClusters : number, maximumClusters : number, maxDistance : number) : [points : any,clusters : any, minimumClusters:number]
{

  for (let i = minimumClusters; i < maximumClusters; i++)
  {
    console.log(`Checking for a valid ${i} cluster solution`);
    let response : WorkerResponse = {};
    response.status = Status.Progess;
    response.message = `Checking for a valid ${i} cluster solution`;
    //console.log(points);
    postMessage(response);
    
    if (points.length > 0)
    {
      if (points[0].length > 2)
      {
        // remove cluster previous labels
        points = points.map(function(val: any[]) {
          return val.slice(0, -1);
        });
      }
    }
    if (points[0].length > 2)
    {
      console.log(`Length is still greater than 2`);
    }
    let clusters = [];
    
    [clusters, points] = createClusters(i,points);
    
    //this.createClusters(i,this.points);
    if (validateSolution(clusters,maxDistance))
    {
      return [points,clusters,minimumClusters];
    }
  }
  console.log(`Unable to find a valid cluster solution between ${minimumClusters} and ${maximumClusters} clusters`);
  return [null,null,0]
}



addEventListener('message', ({ data }) => {
  var points;
  var clusters;
  var minimumClusters;
  setBackend(tf);
  // var message = data.message;
  // var returnedMessage = message + " hi";
  points = data.points;
  clusters = data.clusters;
  minimumClusters = data.minimumClusters;
  [points,clusters,minimumClusters] = FindValidClusters(data.points,data.clusters,data.minimumClusters,data.maximumClusters,data.maxDistance);

  const responseData = {points: points,clusters: clusters,minimumClusters:minimumClusters};
  let response : WorkerResponse = {};
  if (points != null)
  {
    response.status = Status.Complete;
    response.data = responseData;
  }
  else
  {
    response.status = Status.Error;
    response.message = `Unable to find a valid cluster solution between ${data.minimumClusters} and ${data.maximumClusters} clusters`
  }

  postMessage(response);
});
