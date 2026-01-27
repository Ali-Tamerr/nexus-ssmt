# 🧠 Nexus: Social Study Mapping Tool

> **Transform scattered lecture notes into an interactive, visual Knowledge Graph.**

Nexus moves beyond linear folders and lists, allowing students to map logic, visualize connections between assignments and resources, and share their study roadmaps with peers.

![Status](https://img.shields.io/badge/Status-Active_Development-blue)
![Tech Stack](https://img.shields.io/badge/Tech-Next.js_15_%7C_D3.js_%7C_TypeScript-black)

---

## 🎯 The Core Vision

**Nexus** is a **Social Study Mapping** tool designed for students who deal with complex, interconnected subjects (like Computer Science).

Instead of isolating information in separate files, Nexus lets you:

- **Visualize** how "Topic A" is a prerequisite for "Topic B."
- **Link** assignments directly to the specific lectures or resources required to solve them.
- **Share** entire knowledge graphs via a simple link, replacing repetitive manual explanations.

## 🛠️ The Problems We Solve

| Problem                          | The Nexus Solution                                                                         |
| :------------------------------- | :----------------------------------------------------------------------------------------- |
| **Information Fragmentation**    | Connect lecture slides, assignments, and external resources in a single visual map.        |
| **Repetitive Explanations**      | Don't tell a friend what to study—send them the graph. "Here's the path for Assignment 1." |
| **The "Where to Start" Barrier** | Provide a visual roadmap for new or struggling students to find their path immediately.    |
| **Lack of Visual Context**       | Standard note-taking apps are linear. Nexus is spatial, showing logical dependencies.      |

## 🌟 Key Features

- **🕸️ Interactive Knowledge Graphs**: Powered by **D3-force** physics for a dynamic, tactile feel. Nodes float, connect, and react to your touch.
- **⚡ Modern Architecture**: Built on **Next.js 15 (App Router)** and **TypeScript** for high performance and stability.
- **📝 Active Recall & Annotation**: Use drawing tools (pen, shapes) to annotate your graph manually, acting as a digital whiteboard.
- **🔗 Roadmap as a Service**: Turn private study graphs into shareable URLs.
- **📂 Custom `.nxgr` Support**: A dedicated file format for storing, exporting, and importing knowledge maps.

## 📖 Key User Scenarios

### 1. The "Assignment Helper"

_Scenario_: A peer asks, "What do I need to review for Assignment 1?"
_Action_: Instead of sending a list of filenames, you send a Nexus link. They see the "Assignment 1" node connected specifically to "Lecture 3 (Trees)" and "Tutorial 4 (Recursion)."

### 2. Resource Referencing

_Scenario_: You are studying for a difficult exam.
_Action_: You create a central node for the exam topic and attach direct links to Google Classroom PDFs, YouTube explanations, and your own summary notes.

### 3. "Whiteboard" Sessions

_Scenario_: You need to test your memory of a system architecture.
_Action_: You create nodes for the components and use the **Draw Tool** to manually sketch the data flow lines between them, verifying your understanding through active recall.

## 👥 Target Audience

- **Primary**: Computer Science & Technology Students dealing with abstract, dependency-heavy concepts.
- **Secondary**: Top-performing students and Study Groups who create high-value educational roadmaps.


## 🏗️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Visualization**: D3.js, `react-force-graph`
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Data Fetching**: Custom API Client

---

_Nexus is strictly an educational tool aimed at fostering collaboration and clearer understanding of complex academic materials._
