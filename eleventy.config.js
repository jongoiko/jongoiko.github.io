import path from "node:path";
import * as sass from "sass";
import htmlmin from "html-minifier-next";
import { RenderPlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import postcss from "postcss";
import cssnano from "cssnano";
import mdIterator from "markdown-it-for-inline";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it";

const isProduction = process.env.NODE_ENV === "production";

export default function (eleventyConfig) {
  eleventyConfig.setInputDirectory("src");
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy({ static: "/" });
  eleventyConfig.addPlugin(RenderPlugin);
  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css",
    useLayouts: false,
    compile: async function (inputContent, inputPath) {
      let parsed = path.parse(inputPath);
      // Don’t compile file names that start with an underscore
      if (parsed.name.startsWith("_")) {
        return;
      }

      const compiled = sass.compileString(inputContent, {
        loadPaths: [parsed.dir || ".", this.config.dir.includes],
        silenceDeprecations: ["import", "global-builtin", "slash-div"],
      });

      let result = compiled.css;
      if (isProduction) {
        const minified = await postcss([cssnano]).process(compiled.css, {
          from: undefined,
        });
        result = minified.content;
      }

      // Map dependencies for incremental builds
      this.addDependencies(inputPath, compiled.loadedUrls);

      return async (_) => {
        return result;
      };
    },
  });
  eleventyConfig.addTemplateFormats("scss");
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    sharpOptions: {
      animated: true,
    },
  });
  if (isProduction) {
    eleventyConfig.addTransform("htmlmin", function (content) {
      if ((this.page.outputPath || "").endsWith(".html")) {
        return htmlmin.minify(content, {
          useShortDoctype: true,
          removeComments: true,
          collapseWhitespace: true,
        });
      }
      return content;
    });
  }
  let markdownLibrary = markdownIt({
    html: true,
  })
    .use(mdIterator, "url_new_win", "link_open", function (tokens, idx) {
      const [, href] = tokens[idx].attrs.find((attr) => attr[0] === "href");

      if (
        href &&
        !href.includes("jongoiko.github.io") &&
        !href.startsWith("/") &&
        !href.startsWith("#")
      ) {
        tokens[idx].attrPush(["target", "_blank"]);
        tokens[idx].attrPush(["rel", "noopener noreferrer"]);
      }
    })
    .use(markdownItAnchor, {
      permalink: true,
      permalinkClass: "direct-link",
      permalinkSymbol: "#",
    });
  eleventyConfig.setLibrary("md", markdownLibrary);
}

export const config = {
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk",
};
