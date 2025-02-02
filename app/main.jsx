import React, { useRef, useEffect, forwardRef } from 'react'
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet';
import "leaflet-rotatedmarker";
import 'bootstrap/dist/css/bootstrap.min.css';
import NortaGeoJson from '../data/routes.json';
import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Select from 'react-select'
import makeAnimated from 'react-select/animated';

const animatedComponents = makeAnimated();
const ROUTES = NortaGeoJson
    .features
    .filter(f => f.geometry.type === "MultiLineString" && f.properties.route_id)
    .reduce((acc, f) => {
        return {
            ...acc,
            [f.properties.route_id]: <GeoJSON data={f} pathOptions={{ color: f.properties.route_color }} />
        }
    }, {})

const iconVehicle = new L.Icon({
    iconUrl: require('../img/arrow.png'),
    iconRetinaUrl: require('../img/arrow.png'),
    iconAnchor: null,
    shadowUrl: null,
    shadowSize: null,
    shadowAnchor: null,
    iconSize: new L.Point(24, 24),
    className: 'leaflet-marker-icon'
});

const RotatedMarker = forwardRef(({ children, ...props }, forwardRef) => {
    const markerRef = useRef();

    const { rotationAngle, rotationOrigin } = props;
    useEffect(() => {
        const marker = markerRef.current;
        if (marker) {
            marker.setRotationAngle(rotationAngle);
            marker.setRotationOrigin(rotationOrigin);
        }
    }, [rotationAngle, rotationOrigin]);

    return (
        <Marker
            ref={(ref) => {
                markerRef.current = ref;
                if (forwardRef) {
                    forwardRef.current = ref;
                }
            }}
            {...props}
        >
            {children}
        </Marker>
    );
});


class App extends React.Component {
    constructor(props) {
        super(props)
        const routes = localStorage.getItem("routes") || "[]"
        this.state = {
            vehicles: [],
            routes: JSON.parse(routes),
            connected: false,
            tab: "map",
            lastUpdate: new Date(),
            now: new Date(),
        }
        this.handleRouteChange = this.handleRouteChange.bind(this)
    }

    componentDidMount() {
        const scheme = window.location.protocol == "http:" ? "ws" : "wss"
        const url = `${scheme}://${window.location.hostname}:${window.location.port}/ws`
        const conn = new WebSocket(url);
        conn.onclose = () => {
            console.log("Closing websocket")
            this.setState({ connected: false })
        }
        conn.onmessage = (evt) => {
            console.log('onmessage');
            if (!this.state.connected) this.setState({ connected: true })
            const vehicles = JSON.parse(evt.data)
            const lastUpdate = new Date()
            this.setState({
                vehicles,
                lastUpdate,
            })
            console.dir(vehicles)
        }
        this.interval = setInterval(() => this.setState({ now: Date.now() }), 1000);
    }

    componentWillUnmount() {
        clearInterval(this.interval)
    }

    routeComponents() {
        if (this.state.routes.length === 0) return Object.values(ROUTES)

        return this.state.routes
            .map(r => r.value)
            .map(rid => ROUTES[rid])
            .filter(r => r !== null)
    }

    markerComponents() {
        let query = (_v) => true
        if (this.state.routes.length > 0) {
            const values = this.state.routes.map(r => r.value)
            query = (v) => values.includes(v.rt)
            console.log("query filter on routes: " + values)
        }

        return this.state.vehicles
            .filter(query)
            .map(v => {
                const coords = [v.lat, v.lon].map(parseFloat)
                const rotAng = parseInt(v.hdg, 10)
                return <RotatedMarker key={v.vid} position={coords} icon={iconVehicle} rotationAngle={rotAng} rotationOrigin="center">
                    <Popup>
                        {v.rt + " - " + v.des + " - " + v.tmstmp}
                    </Popup>
                </RotatedMarker>
            })
    }

    mapContainer() {
        if (!this.state.connected) return this.notConnectedScreen()

        return <MapContainer center={[29.95569, -90.0786107]} zoom={13}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {this.markerComponents()}
            {this.routeComponents()}
        </MapContainer>
    }

    notConnectedScreen() {
        return <Row className="justify-content-md-center">
            <Col md="auto">
                <p>Looks like you aren't connected. Maybe try refreshing the page. If it's not working please <a href="https://github.com/codefornola/nola-transit-map/issues">get in touch with us</a>.</p>
            </Col>
        </Row>
    }

    settingsContainer() {
        if (!this.state.connected) return this.notConnectedScreen()

        if (this.state.vehicles.length === 0) {
            return <Row className="justify-content-md-center">
                <Col md="auto">
                    <p>No Vehicles found yet. Are you connected?</p>
                </Col>
            </Row>
        }

        const routes = [...new Set(this.state.vehicles.map(v => v.rt))]
        const routeOptions = routes.map(r => {
            return { value: r, label: r }
        })

        return <Container>
            <Row className="justify-content-md-center">
                <Col md="auto">
                    <h3>Select routes to show on map</h3>
                    <p>You can select multiple routes</p>
                </Col>
            </Row>
            <Row className="justify-content-md-center">
                <Col md="auto">
                    <Select
                        closeMenuOnSelect={false}
                        components={animatedComponents}
                        defaultValue={[]}
                        value={this.state.routes}
                        isMulti
                        options={routeOptions}
                        onChange={this.handleRouteChange}
                    />
                </Col>
            </Row>

        </Container>
    }

    aboutContainer() {
        return <Container>
            <Row className="justify-content-md-center">
                <Col md="auto">
                    <h1>NOLA transit map</h1>
                </Col>
            </Row>
            <Row className="justify-content-md-center">
                <Col md="auto">
                    <p>Created by <a href="https://codeforneworleans.org/">Code For New Orleans</a></p>
                </Col>
            </Row>
            <Row className="justify-content-md-center">
                <Col md="auto">
                    <h2>About</h2>
                </Col>
            </Row>
            <Row className="justify-content-md-center">
                <Col md="auto">
                    <p>
                        When the RTA switched to the new LePass app, all of the realtime data
                        stopped working. Relying on public transportation in New Orleans without this data is extremely challenging.
                        We made this map as a stop gap until realtime starts working again.

                        If you find an problem, or have a feature request, consider <a href="https://github.com/codefornola/nola-transit-map/issues">filing an issue here</a>.
                        You can also join us on slack in the #civic-hacking channel of the <a href="https://join.slack.com/t/nola/shared_invite/zt-4882ja82-iGm2yO6KCxsi2aGJ9vnsUQ">Nola Devs slack</a>.

                        Take a look at <a href="https://github.com/codefornola/nola-transit-map">the README on GitHub</a> to learn more about how it works.
                    </p>
                </Col>
            </Row>
        </Container>

    }

    onTabSelect(eventKey) {
        this.setState({ tab: eventKey });
    }

    handleRouteChange(routes) {
        this.setState({ routes })
        localStorage.setItem("routes", JSON.stringify(routes))
    }

    content() {
        switch (this.state.tab) {
            case "about":
                return this.aboutContainer()
            case "settings":
                return this.settingsContainer()
            default:
                return this.mapContainer()
        }
    }

    lagging() {
        // lagging by over 13 seconds
        return Math.floor((this.state.now - this.state.lastUpdate) / 1000) > 13
    }

    render() {
        let connectionStatus = this.state.connected ? "✅" : "❌"
        if (this.state.connected && this.lagging()) connectionStatus = "⚠"
        return <div className="App">
            <header>
                <Nav fill variant="pills" defaultActiveKey="map" onSelect={this.onTabSelect.bind(this)}>
                    <Nav.Item>
                        <Nav.Link eventKey="map">Map</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="settings">Routes</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="about">About</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        {/* <Nav.Link eventKey="meta" disabled >{timeSince(this.state.lastUpdate, this.state.now)}</Nav.Link> */}
                        <Nav.Link eventKey="meta" disabled>{connectionStatus}</Nav.Link>
                    </Nav.Item>
                </Nav>
            </header>
            <main>
                {this.content()}
            </main>
        </div>
    }
}

window.initApp = function () {
    console.log("initApp()")

    const root = createRoot(
        document.getElementById('main')
    )

    root.render(<App />)
}
