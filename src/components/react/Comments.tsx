import * as React from "react";
import Giscus from "@giscus/react";
import { CATEGORY, REPO, REPO_ID } from "../../const";

const id = "inject-comments";

const Comments = () => {
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<div id={id}>
			{mounted ? (
				<Giscus
					id={id}
					repo={REPO}
					repoId={REPO_ID}
					category={CATEGORY}
					categoryId="DIC_kwDOO3eB3M4CrJL8"
					mapping="og:title"
					reactionsEnabled="1"
					emitMetadata="1"
					inputPosition="top"
					theme="preferred_color_scheme"
					lang="en"
					loading="lazy"
				/>
			) : null}
		</div>
	);
};

export default Comments;
