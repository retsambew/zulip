import $ from "jquery";
import tippy from "tippy.js";

import render_message_view_header from "../templates/message_view_header.hbs";
import render_message_view_header_tooltip from "../templates/message_view_header_tooltip.hbs";

import {$t} from "./i18n";
import * as inbox_util from "./inbox_util";
import * as narrow_state from "./narrow_state";
import * as peer_data from "./peer_data";
import * as recent_view_util from "./recent_view_util";
import * as rendered_markdown from "./rendered_markdown";
import * as search from "./search";
import {parse_html} from "./ui_util";

function get_formatted_sub_count(sub_count) {
    if (sub_count >= 1000) {
        // parseInt() is used to floor the value of division to an integer
        sub_count = Number.parseInt(sub_count / 1000, 10) + "k";
    }
    return sub_count;
}

function make_message_view_header(filter) {
    const message_view_header = {};
    if (recent_view_util.is_visible()) {
        return {
            title: $t({defaultMessage: "Recent conversations"}),
            icon: "clock-o",
        };
    }
    if (inbox_util.is_visible()) {
        return {
            title: $t({defaultMessage: "Inbox"}),
            zulip_icon: "inbox",
        };
    }
    if (filter === undefined) {
        return {
            title: $t({defaultMessage: "All messages"}),
            icon: "align-left",
        };
    }
    message_view_header.title = filter.get_title();
    filter.add_icon_data(message_view_header);
    if (filter.has_operator("stream") && !filter._sub) {
        message_view_header.sub_count = "0";
        message_view_header.formatted_sub_count = "0";
        message_view_header.rendered_narrow_description = $t({
            defaultMessage: "This stream does not exist or is private.",
        });
        return message_view_header;
    }
    if (filter._sub) {
        // We can now be certain that the narrow
        // involves a stream which exists and
        // the current user can access.
        const current_stream = filter._sub;
        message_view_header.rendered_narrow_description = current_stream.rendered_description;
        const sub_count = peer_data.get_subscriber_count(current_stream.stream_id);
        message_view_header.sub_count = sub_count;
        message_view_header.formatted_sub_count = get_formatted_sub_count(sub_count);
        // the "title" is passed as a variable and doesn't get translated (nor should it)
        message_view_header.sub_count_tooltip_text = $t(
            {defaultMessage: "This stream has {count} subscribers."},
            {count: message_view_header.sub_count},
        );
        message_view_header.stream_settings_link =
            "#streams/" + current_stream.stream_id + "/" + current_stream.name;
    }
    return message_view_header;
}

export function colorize_message_view_header() {
    const filter = narrow_state.filter();
    if (filter === undefined || !filter._sub) {
        return;
    }
    // selecting i instead of .fa because web public streams have custom icon.
    $("#message_view_header a.stream i").css("color", filter._sub.color);
}

function append_and_display_title_area(message_view_header_data) {
    const $message_view_header_elem = $("#message_view_header");
    $message_view_header_elem.empty();
    const rendered = render_message_view_header(message_view_header_data);
    $message_view_header_elem.append(rendered);
    if (message_view_header_data.stream_settings_link) {
        colorize_message_view_header();
    }
    $message_view_header_elem.removeClass("notdisplayed");
    const $content = $message_view_header_elem.find("span.rendered_markdown");
    if ($content) {
        // Update syntax like stream names, emojis, mentions, timestamps.
        rendered_markdown.update_elements($content);
    }
}

function build_message_view_header(filter) {
    // This makes sure we don't waste time appending
    // message_view_header on a template where it's never used
    if (filter && !filter.is_common_narrow()) {
        search.open_search_bar_and_close_narrow_description();
        $("#search_query").val(narrow_state.search_string());
    } else {
        const message_view_header_data = make_message_view_header(filter);
        append_and_display_title_area(message_view_header_data);
        search.close_search_bar_and_open_narrow_description();
    }
}

// Add tooltip to stream name
$("body").on("mouseenter", ".message-header-stream-settings-button", (e) => {
    e.stopPropagation();
    const $elem = $(e.currentTarget);
    const current_stream = narrow_state.filter()._sub;
    const stream = current_stream.name;
    const sub_count = peer_data.get_subscriber_count(current_stream.stream_id);
    const data = {stream, sub_count};

    tippy($elem[0], {
        delay: 0,
        // Don't show tooltip on touch devices (99% mobile) since touch pressing on it will open stream settings
        touch: false,
        content: () => parse_html(render_message_view_header_tooltip(data)),
        arrow: true,
        placement: "bottom",
        showOnCreate: true,
        onHidden(instance) {
            instance.destroy();
        },
        appendTo: () => document.body,
    });
});

export function initialize() {
    render_title_area();
}

export function render_title_area() {
    const filter = narrow_state.filter();
    build_message_view_header(filter);
}

// This function checks if "modified_sub" which is the stream whose values
// have been updated is the same as the stream which is currently
// narrowed (filter._sub) and rerenders if necessary
export function maybe_rerender_title_area_for_stream(modified_sub) {
    const filter = narrow_state.filter();
    if (filter && filter._sub && filter._sub.stream_id === modified_sub.stream_id) {
        render_title_area();
    }
}
