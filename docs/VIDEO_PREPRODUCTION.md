# CoWork App — DevOps Explainer Video Preproduction

## Positioning

- **Audience:** DevOps recruiters.
- **Objective:** demonstrate an end-to-end, observable and secured delivery workflow around a real microservices product.
- **Runtime:** 80 seconds, 16:9, 1920×1080, 30 FPS, English voice-over.
- **Truthfulness rule:** show implemented functionality only. Phase 13 multi-environment delivery is labelled as the next milestone, not as a deployed capability. The project has no AI feature, so no AI engine or AI claim appears in the film.

## Narrative

CoWork App begins as a concrete collaboration problem: teams need a responsive, persistent real-time workspace. The film follows one message from the interface through the application architecture, then follows a code change through quality gates, container delivery, GitOps deployment, observability, alerting, and security. The closing proposition is not that the app is merely built, but that it can be delivered and operated with confidence.

## Visual Direction

| Element | Direction |
|---|---|
| World | Premium orthographic 3D isometric mini-datacenter, with interface panels used sparingly as truthful UI evidence. |
| Palette | `#081321` deep navy, `#101C2F` charcoal, `#16D9FF` cyan, `#5967FF` blue, `#A855F7` purple, `#FF9D3D` action orange, `#EEF6FF` text. |
| Materials | Matte graphite infrastructure, frosted glass panels, emissive cyan data paths, selective orange gates/alerts. |
| Camera | Orthographic 35° isometric view; slow dolly and orbit moves, no rapid zooms. |
| Motion | Clear cause/effect: a message becomes an event, a commit becomes a release, a metric becomes an alert. Particle motion always follows a real path. |
| Typography | Inter or equivalent geometric sans; short labels only, in English. |
| Sound | Restrained electronic bed; one distinct sound motif for message, validation gate, deployment, and alert resolution. |

## Storyboard — 80 seconds

| # | Time | Message and voice-over | Image, camera and animation | On-screen text / sound |
|---:|---:|---|---|---|
| 1 | 0–7s | “Collaboration only works when conversations move as fast as the people behind them.” | A dark isometric workspace wakes up. Three small team pods illuminate; a CoWork App UI panel rises from the centre. Slow descending dolly. | `CoWork App` · soft startup pulse. |
| 2 | 7–16s | “CoWork App gives teams authenticated rooms, real-time messages, presence, typing feedback, and message history.” | A user authenticates, enters a room, types, and sends one message. Cyan pulse moves to a second member; presence dots react. Use the actual chat screen as a floating reference panel, not a fabricated product view. | `Real-time collaboration` · message ping. |
| 3 | 16–27s | “Behind the interface, Nginx routes traffic to focused Auth, Profiles, and Messaging services.” | Camera pulls back to reveal the gateway and three labelled service blocks. Message path branches from React through Nginx to Messaging; a JWT verification pulse reaches Auth. | `React → Nginx → Microservices` · data whooshes. |
| 4 | 27–35s | “PostgreSQL persists data. Redis supports sessions and active collaboration. RabbitMQ carries messaging events.” | The Messaging block connects to database cylinders, Redis cache blocks, and a RabbitMQ event channel. One message becomes a stored record and an event packet. | `PostgreSQL · Redis · RabbitMQ` · subtle event ticks. |
| 5 | 35–45s | “Every change begins in GitHub, then Jenkins runs linting, tests, quality analysis, image builds, and vulnerability scans.” | Match cut from code commit tile to a Jenkins pipeline conveyor. Gates light up sequentially: ESLint, Jest/Supertest, SonarCloud, Docker build, Trivy. Orange blocks failures; cyan allows a validated image forward. | `Commit → Verify → Build → Scan` · crisp gate chimes. |
| 6 | 45–55s | “Validated images are published to Docker Hub, while Helm describes the release.” | A signed-looking container image (no unverified certification claim) passes to a Docker Hub registry tower. Helm chart cards compose a Kubernetes deployment blueprint. | `Docker Hub · Helm` · container lock-in sound. |
| 7 | 55–65s | “Argo CD continuously reconciles the declared state into Kubernetes.” | Camera tracks the Git declaration into Argo CD, then across a Minikube/Kubernetes cluster: deployments, services, ingress, and Nginx gateway assemble. Existing GitOps automation is the focus; multi-environment promotion is not shown as complete. | `GitOps with Argo CD` · controlled deployment swell. |
| 8 | 65–75s | “Prometheus, Grafana, Loki, and Sentry make health, logs, and errors visible. AlertManager sends actionable alerts to Discord.” | Observability rings surround the live cluster: metrics chart rises, logs stream to Loki, an error routes to Sentry, a PodDown-style pulse reaches AlertManager then Discord; the service recovers and the pulse turns cyan. | `Observe · Detect · Respond` · brief alert, then resolve chime. |
| 9 | 75–80s | “CoWork App: a real-time product, delivered with quality, security, and operational visibility.” | All layers resolve into a composed isometric platform. The CoWork App mark and final statement appear. Camera eases back into the navy background. | `Build. Deploy. Observe. Improve.` · music resolves. |

## Accuracy Notes for Production

- The chat interface shows a file area and search UI, but this video will not claim implemented upload or search workflows without a validated backend path.
- Security visuals may represent the implemented practices: Kubernetes Secrets, network policies, `securityContext`, RBAC, Trivy and Dependabot. Avoid absolute statements such as “unbreakable” or “fully secure.”
- Phase 13 is in progress. If included in a later cut, show it only as `Next milestone: dev / staging / prod`.
- The pipeline is a visual explanation of documented Jenkins stages; it must not imply a production cloud cluster when the deployed environment is Minikube local Kubernetes.

## Keyframe Approval Set

Create these three stills before animating:

1. **Product keyframe:** the isometric CoWork App workspace and real chat UI panel (scene 2).
2. **Architecture keyframe:** React, Nginx, three services and data dependencies connected by labelled paths (scenes 3–4).
3. **DevOps keyframe:** GitHub → Jenkins quality gates → Docker Hub → Argo CD → Kubernetes, wrapped by observability (scenes 5–8).

## Production Status

Preproduction is complete. The creative direction and storyboard require approval before keyframe generation and animation. Blender and FFmpeg are not currently available in this workspace, so rendering cannot start until a rendering route is selected or those tools are installed.
