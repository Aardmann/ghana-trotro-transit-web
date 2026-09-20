# Ghana Trotro Transit Web

Owned by [Nxnx Tech](https://nxnx.tech)

Ghana Trotro Transit is a web app designed to help commuters in Ghana navigate trotro routes more easily. It brings together route search, stop discovery, nearby transit information, and trip planning in a single experience that feels clear and mobile-friendly.

## Overview

This project helps users:

- Search for trotro routes and stops across Ghana
- Find nearby transport options based on their location
- Explore route details, stop lists, and trip connections
- View route information in a simple map-based interface
- Share route information with others
- Save recent searches and user preferences in the browser

The app is built as a React web application and is intended to make daily commuting more predictable and easier to understand.

## Tech Stack

- React
- JavaScript / JSX
- Supabase for backend data access
- React Scripts for app development and build tooling
- CSS for styling and responsive layout

## Project Structure

- src/ — application source code
- public/ — public static files
- functions/ — serverless/middleware helpers
- build/ — production build output

## Getting Started

### Prerequisites

Before you start, make sure you have:

- Node.js 18+ installed
- npm installed
- Access to the project environment variables for Supabase

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root and add the following values:

```bash
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If your environment uses different variable names, make sure they match the app configuration in the project.

### Run locally

```bash
npm start
```

This starts the development server in your browser environment.

### Production build

```bash
npm run build
```

## Contributing

We welcome contributions from the community. Contributions help improve route coverage, data quality, usability, and the overall experience.

### How to contribute

1. Fork the repository to your own GitHub account.
2. Create a feature branch:

```bash
git checkout -b feature/your-change
```

3. Make your changes in a focused and well-documented way.
4. Run the relevant checks locally:

```bash
npm run build
```

5. Commit your work with a clear message:

```bash
git add .
git commit -m "Add your feature or fix"
```

6. Push your branch:

```bash
git push origin feature/your-change
```

7. Open a pull request in the main repository and include:
   - a short summary of the change
   - why the change is needed
   - screenshots or notes if the UI changed
   - any testing or validation performed

### Pull request guidelines

- Keep pull requests focused on one issue or feature at a time.
- Write clear commit messages.
- Update documentation when behavior or setup changes.
- Make sure the app still builds successfully.
- Be respectful and collaborative in reviews.

### Good contribution ideas

- Improve route search accuracy
- Fix UI or usability issues
- Add accessibility improvements
- Improve mobile experience
- Clean up logic and performance issues
- Improve documentation and onboarding

## Ownership

This project is owned and maintained by [Nxnx Tech](https://nxnx.tech). Contributions are welcome, but the final project direction and repository ownership remain with Nxnx Tech.

## Contact

For questions about the project, collaboration, or contributions, please contact the project maintainer through the Nxnx Tech channel or the repository owner as appropriate.

## License

This project does not currently declare a license in the repository. If you plan to contribute, please check with the project owner or maintainers before using the code beyond standard open-source collaboration expectations.
