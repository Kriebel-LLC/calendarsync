import { Button } from "components/ui/button";
import React from "react";

/**
 * Component that renders buttons to scroll to the top and bottom of the page
 */
export function Scroller(props: {
    onClickScrollTop: () => void;
    onClickScrollBottom: () => void;
}) {
    return (
        <div className="grid gap-3 grid-cols-2 mt-3 w-full">
            <Button onClick={() => props.onClickScrollTop()}>
                Scroll To Top
            </Button>
            <Button onClick={() => props.onClickScrollBottom()}>
                Scroll To Bottom
            </Button>
        </div>
    );
}
