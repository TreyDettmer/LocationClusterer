import { AfterViewInit, Component, OnInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {


  private map : any;
  private markers : L.LayerGroup = new L.LayerGroup();

  private miniMarkers : L.LayerGroup = new L.LayerGroup();
  private icons : any = [];
  private miniIcons : any = [];
  private colors : string[] = [];
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

    

    for (let i = 0; i < 25; i++)
    {
      var randomColor = Math.floor(Math.random()*16777215).toString(16);
      this.colors.push(`#${randomColor}`);
      let markerHtmlStyles = `
      background-color: #${randomColor};
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
        html: `<span style="${markerHtmlStyles}" />`
      })

      let miniMarkerHtmlStyles = `
      background-color: #${randomColor};
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

  public PanTo(latLng : L.LatLng)
  {
    this.map.panTo(latLng);
  }

  public UpdateMapMarkers(clusters : any)
  {
    for (let cluster in clusters)
    {
      let averageLatitude : number = 0;
      let averageLongitude : number = 0;
      let clusterIndex = parseInt(cluster);
      //console.log(`${typeof cluster}: ${cluster}`);
      [averageLatitude,averageLongitude] = this.getAveragePoint(clusters[cluster]);
      var marker = L.marker([averageLatitude,averageLongitude],{icon:this.icons[clusterIndex]});
      marker.on("click",(e) =>
      {
        this.displayPointsInCluster(clusters,clusterIndex);
      });
      marker.addTo(this.markers);
    }
    console.log("creating convex hulls");
    for (let cluster in clusters)
    {
      let clusterIndex = parseInt(cluster);
      var hulledPoints = this.convexHull(clusters[cluster]);
      var polygon = L.polygon(hulledPoints,{color:this.colors[clusterIndex]});
      polygon.addTo(this.markers);
    }
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

  private displayPointsInCluster(clusters : any, clusterIndex:number)
  {
    this.miniMarkers.clearLayers();
    let cluster = clusters[clusterIndex];
    for (let i = 0; i < cluster.length; i++)
    {
      var marker = L.marker([cluster[i][0],cluster[i][1]],{icon:this.miniIcons[clusterIndex]});

      marker.addTo(this.miniMarkers);
    }
    console.log(`displaying points in cluster ${clusterIndex}`);
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
