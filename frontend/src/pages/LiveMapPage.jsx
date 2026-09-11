import LiveMap from "../components/map/LiveMap.jsx";

// Thin page wrapper for the /dashboard/map route. LiveMap itself is
// untouched — this file exists only to give the map its own route distinct
// from Overview, per the routing split. No new logic here.
function LiveMapPage() {
  return (
    <div className="w-full h-full">
      <LiveMap />
    </div>
  );
}

export default LiveMapPage;
