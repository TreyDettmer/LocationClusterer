import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {


  private map : any;
  private markers : L.FeatureGroup = new L.FeatureGroup();

  private miniMarkers : L.FeatureGroup = new L.FeatureGroup();
  private icons : any = [];
  private miniIcons : any = [];
  private colors : string[] = ["#e6194B","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#42d4f4","#f032e6","#bfef45","#fabed4","#469990","#dcbeff","#9A6324","#fffac8","#800000","#aaffc3","#808000","#ffd8b1","#000075","#a9a9a9"];

  @Output() OnInnerClusterPointClicked = new EventEmitter<{innerPointIndex : number, clusterIndex : number}>();
  constructor() { }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void 
  {
    this.map = L.map('map', {
      center: [ 39.8282, -98.5795 ],
      zoom: 4,
      layers: [this.markers,this.miniMarkers]
    });

    const tiles : L.TileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 4,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    this.map.on("dblclick",(_:any) =>
    {
      this.miniMarkers.clearLayers();
    });

    for (let i = 0; i < 25; i++)
    {

      let markerHtmlStyles = `
      background-color: ${this.colors[i % this.colors.length]};
      width: 1.25rem;
      height: 1.25rem;
      display: block;
      left: 0;
      top: 0;
      position: relative;
      border-radius: 1.25rem;
      border: 1px solid #FFFFFF`;

      let icon = L.divIcon({
        className: "map-pin",
        iconSize: [25,25],
        html: `<span style="${markerHtmlStyles}"/>`
      })

      let miniMarkerHtmlStyles = `
      background-color: ${this.colors[i % this.colors.length]};
      width: 1rem;
      height: 1rem;
      display: block;
      left: 0;
      top: 0;
      position: relative;
      border-radius: 1rem;
      border: 1px solid #FFFFFF`;

      let miniIcon = L.divIcon({
        className: "mini-pin-mini",
        iconSize: [10,10],
        html: `<span style="${miniMarkerHtmlStyles}" />`
      })
      this.icons.push(icon);
      this.miniIcons.push(miniIcon);
    }
  }

  /**
  * Gets distance in miles between two points on earth.
  * @param {number[]} origin
  * @param {number[]} destination
  */
  private distance(origin : any, destination : any) : number
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

  public PanTo(latLng : L.LatLng)
  {
    this.map.panTo(latLng);
  }

  public UpdateMapMarkers(clusters : any)
  {
    this.markers.clearLayers();

    console.log("creating convex hulls");
    for (let i = 0; i < clusters.length; i++)
    {
      let clusterIndex = i;
      var hulledPoints = this.convexHull(clusters[clusterIndex]);
      var polygon = L.polygon(hulledPoints,{color:this.colors[clusterIndex]});
      polygon.on("click",(e) =>
      {
        this.DisplayPointsInCluster(clusters,clusterIndex);
      });
      polygon.bindTooltip(`Cluster ${clusterIndex}`, {direction:"center", offset: [0, 0] });
      polygon.addTo(this.markers);
    }
    this.map.fitBounds(this.markers.getBounds().pad(0.5));
  }

  public ClearMarkers()
  {
    this.markers.clearLayers();
  }

  public UpdateMapCenter(points : any)
  {
    let averageLatitude : number = 0;
    let averageLongitude : number = 0;
    for (let row = 0; row < points.length; row++)
    {
      averageLatitude += points[row][0];
      averageLongitude += points[row][1];
    }
    averageLatitude /= points.length;
    averageLongitude /= points.length;
    this.map.panTo(new L.LatLng(averageLatitude, averageLongitude));
  }

  public DisplayPointsInCluster(clusters : any, clusterIndex:number)
  {
    this.miniMarkers.clearLayers();
    let cluster = clusters[clusterIndex];
    // this.miniMarkers.getLayers()
    let displayedMiniMarkers : any[] = [];
    let hiddenMarkerCount = 0;
    for (let i = 0; i < cluster.length; i++)
    {
      let shouldDisplay = true;
      for (let j = 0; j < displayedMiniMarkers.length; j++)
      {
        if (this.distance(displayedMiniMarkers[j],[cluster[i][0],cluster[i][1]]) < 5.0)
        {
          hiddenMarkerCount++;
          shouldDisplay = false;
          break;
        }
      }
      if (shouldDisplay == false)
      {
        continue;
      }
      var marker = L.marker([cluster[i][0],cluster[i][1]],{icon:this.miniIcons[clusterIndex]});
      displayedMiniMarkers.push([cluster[i][0],cluster[i][1]]);
      marker.on("click",(e) =>
      {
        this.InnerClusterPointClicked(i,clusterIndex);
      });
      marker.addTo(this.miniMarkers);
    }
    console.log(`hid ${hiddenMarkerCount} points`);
  }

  public InnerClusterPointClicked(innerPointIndex : number, clusterIndex : number)
  {
    this.OnInnerClusterPointClicked.emit({innerPointIndex,clusterIndex});
  }

  private getAveragePoint(points : any) : [number, number]
  {
    let averageLatitude : number = 0;
    let averageLongitude : number = 0;
    for (let row = 0; row < points.length; row++)
    {
      averageLatitude += points[row][0];
      averageLongitude += points[row][1];
    }
    averageLatitude /= points.length;
    averageLongitude /= points.length;
    return [averageLatitude,averageLongitude];
  }

  private cross(a : any, b : any, o : any) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  }
 

  private convexHull(points: any) 
  {
    points.sort(function(a : any, b : any) {
       return a[0] == b[0] ? a[1] - b[1] : a[0] - b[0];
    });
 
    var lower = [];
    for (var i = 0; i < points.length; i++) {
       while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
          lower.pop();
       }
       lower.push(points[i]);
    }
 
    var upper = [];
    for (var i = points.length - 1; i >= 0; i--) {
       while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
          upper.pop();
       }
       upper.push(points[i]);
    }
 
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }


}
